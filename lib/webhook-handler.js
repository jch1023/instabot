
// Webhook event handler - processes Instagram comment events
import { getAllCampaigns, createDmLog, getSetting, setSetting } from './db.js';
import { sendPrivateReply, renderDmMessage, getFollowers } from './instagram.js';

/**
 * Get the Instagram access token from DB settings or environment
 */
async function getAccessToken() {
    // Try DB first, then environment variable
    const dbToken = await getSetting('instagram_access_token');
    if (dbToken) return dbToken;
    return process.env.INSTAGRAM_ACCESS_TOKEN || '';
}

/**
 * Process an incoming comment webhook event
 */
export async function handleCommentEvent(event) {
    const { id: commentId, text: commentText, from } = event;
    const userId = from?.id;
    const username = from?.username || 'unknown';
    const mediaId = event.media?.id;

    if (!commentId || !commentText || !userId) {
        console.log('[Webhook] Skipping: missing comment data');
        return { processed: false, reason: 'missing_data' };
    }

    // Find matching active campaigns (webhook mode only)
    const allCampaigns = await getAllCampaigns();
    const campaigns = allCampaigns.filter(c => c.is_active && c.execution_mode === 'webhook');

    // 디버깅 정보 추가 (로그에서 확인용)
    const debugInfo = {
        totalCampaigns: allCampaigns.length,
        activeWebhookCampaigns: campaigns.length
    };

    const results = [];

    // 캠페인이 없으면 로그에 기록
    if (campaigns.length === 0) {
        console.log('[Webhook] No active webhook campaigns found');
        return { processed: true, results: [], debug: debugInfo, reason: 'No active campaigns matched' };
    }

    for (const campaign of campaigns) {
        // Check if campaign targets this media or all media
        if (campaign.ig_media_id && campaign.ig_media_id !== mediaId) {
            results.push({ campaignId: campaign.id, status: 'skipped', reason: `Media ID mismatch (Target: ${campaign.ig_media_id}, Actual: ${mediaId})` });
            continue;
        }

        // Check keyword trigger
        if (campaign.trigger_type === 'keyword') {
            const keywords = JSON.parse(campaign.keywords || '[]');
            const commentLower = commentText.toLowerCase();
            const matched = keywords.some(kw => commentLower.includes(kw.toLowerCase().trim()));
            if (!matched) {
                results.push({ campaignId: campaign.id, status: 'skipped', reason: `Keyword mismatch (Keywords: ${keywords.join(', ')}, Comment: "${commentText}")` });
                continue;
            }
        }

        // Determine which DM to send
        let dmText = '';
        let followerStatus = null;
        let isFollow = false; // 기본값: 비팔로워

        if (campaign.check_follower) {
            // [최종 해결책] "내 팔로워 목록 검색" 방식
            // 단건 조회는 User Consent 가 필요해서 불가능함.
            // 대신 내 팔로워 목록(최신순)을 가져와서 거기 포함되어 있는지 확인.
            console.log(`[Webhook] Verifying follower status via My Followers List (Search User ID: ${userId})...`);

            try {
                const accessToken = await getAccessToken();
                if (accessToken) {
                    // 최신 팔로워 200명 가져오기 (API 호출 1~2회)
                    // 방금 팔로우한 사람은 무조건 최상단에 뜸.

                    let found = false;
                    let afterCursor = null;
                    let pagesChecked = 0;
                    const MAX_PAGES = 3; // 최대 3페이지(약 300~500명)까지만 검색 (속도 위해)

                    while (!found && pagesChecked < MAX_PAGES) {
                        const data = await getFollowers(accessToken, 'me', afterCursor);
                        const followers = data.followers || [];

                        console.log(`[Webhook] Fetched page ${pagesChecked + 1}: ${followers.length} followers.`);

                        // 목록에서 ID 검색
                        const match = followers.find(f => f.id === userId || f.username === username);
                        if (match) {
                            found = true;
                            isFollow = true;
                            console.log(`[Webhook] ✅ Found @${username} in followers list!`);
                            break;
                        }

                        // 다음 페이지 준비
                        afterCursor = data.paging?.cursors?.after;
                        if (!afterCursor) break; // 더 이상 데이터 없음
                        pagesChecked++;
                    }

                    if (!found) {
                        console.log(`[Webhook] ❌ User @${username} NOT found in recent followers list (Checked ${pagesChecked + 1} pages).`);
                        isFollow = false;
                    }

                } else {
                    console.error('[Webhook] No access token, cannot verify follower status.');
                    isFollow = false;
                }
            } catch (e) {
                console.error('[Webhook] Follower list check failed:', e.message);
                isFollow = false;
            }

            followerStatus = isFollow ? 1 : 0;
            dmText = isFollow ? campaign.dm_follower : campaign.dm_non_follower;
        } else {
            // 팔로우 체크 안 하는 캠페인 -> 기본 DM
            dmText = campaign.dm_default;
        }

        if (!dmText) {
            console.log(`[Webhook] Campaign ${campaign.id}: no DM text configured (Follower: ${isFollow})`);
            results.push({ campaignId: campaign.id, status: 'skipped', reason: 'No DM text configured' });
            continue;
        }

        // Render template variables
        dmText = renderDmMessage(dmText, { username, comment: commentText });

        // Send the DM via Private Reply
        try {
            const accessToken = await getAccessToken();

            if (!accessToken) {
                throw new Error('No access token configured.');
            }

            await sendPrivateReply(accessToken, commentId, dmText);

            // Mark as processed to prevent duplicate if switched to polling
            await setSetting(`processed_comment_${commentId}`, 'sent_via_webhook');

            // Log success
            await createDmLog({
                campaign_id: campaign.id,
                ig_user_id: userId,
                ig_username: username,
                comment_id: commentId,
                comment_text: commentText,
                is_follower: followerStatus,
                dm_sent: dmText,
                status: 'sent',
            });

            results.push({ campaignId: campaign.id, status: 'sent', dmText, isFollower: followerStatus });
            console.log(`[Webhook] ✅ DM sent to @${username} for campaign "${campaign.name}"`);
        } catch (error) {
            // Log failure
            await createDmLog({
                campaign_id: campaign.id,
                ig_user_id: userId,
                ig_username: username,
                comment_id: commentId,
                comment_text: commentText,
                is_follower: followerStatus,
                dm_sent: dmText,
                status: 'failed',
                error_message: error.message,
            });

            results.push({ campaignId: campaign.id, status: 'failed', error: error.message });
            console.error(`[Webhook] ❌ DM failed for @${username}:`, error.message);
        }
    }

    return { processed: true, results };
}

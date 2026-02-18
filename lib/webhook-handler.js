
// Webhook event handler - processes Instagram comment events
import { getAllCampaigns, createDmLog, getSetting, setSetting, isFollower, cacheFollowers } from './db.js';
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
            // [하이브리드 팔로워 체크]
            // 전략:
            // 1. DB 캐시 먼저 확인 (대부분의 기존 팔로워는 여기서 통과)
            // 2. 없으면 -> API로 최신 팔로워 목록(300명) 조회 (방금 팔로우한 사람 확인용)
            // 3. 찾으면 -> DB에 저장해주고 통과.

            console.log(`[Webhook] Checking follower status for @${username} (ID: ${userId})...`);

            try {
                // 1. DB 검색
                isFollow = await isFollower(campaign.account_id || 1, userId);

                if (isFollow) {
                    console.log(`[Webhook] ✅ Match found in DB Cache.`);
                } else {
                    // 2. 실시간 최신 목록 검색 (User Consent 에러 회피를 위해 '내 팔로워 목록' 조회)
                    console.log(`[Webhook] Not in DB. Searching API latest followers...`);

                    const accessToken = await getAccessToken();
                    if (accessToken) {
                        let found = false;
                        let afterCursor = null;
                        let pages = 0;
                        const MAX_PAGES = 3; // 최신 3페이지(약 300명)까지만 뒤짐 (속도 최적화)

                        while (!found && pages < MAX_PAGES) {
                            const data = await getFollowers(accessToken, 'me', afterCursor);
                            const followers = data.followers || [];

                            const match = followers.find(f => f.id === userId || f.username === username);
                            if (match) {
                                found = true;
                                isFollow = true;
                                console.log(`[Webhook] ✅ Found in API latest list! Adding to DB.`);
                                // 찾았으니 DB에 영구 저장
                                cacheFollowers(campaign.account_id || 1, [{ id: userId, username }]).catch(console.error);
                                break;
                            }

                            afterCursor = data.paging?.cursors?.after;
                            if (!afterCursor) break;
                            pages++;
                        }
                    }
                }
            } catch (e) {
                console.error('[Webhook] Follower check error:', e.message);
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

            results.push({
                action: 'DM_REPLY',
                trigger_comment: commentText,
                campaign_name: campaign.name || 'Campaign #' + campaign.id,
                recipient: username,
                dm_content: dmText,
                is_follower: followerStatus,
                status: 'success'
            });
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

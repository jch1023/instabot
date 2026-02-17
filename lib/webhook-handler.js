
// Webhook event handler - processes Instagram comment events
import { getAllCampaigns, createDmLog, isFollower, getSetting, setSetting, cacheFollowers } from './db.js';
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
        activeWebhookCampaigns: campaigns.length,
        firstCampaignSample: allCampaigns[0] ? {
            id: allCampaigns[0].id,
            active: allCampaigns[0].is_active,
            mode: allCampaigns[0].execution_mode
        } : 'none'
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

        if (campaign.check_follower) {
            // 1. DB 캐시 확인
            let isFollow = await isFollower(campaign.account_id || 1, userId);

            // 2. 캐시에 없고, 팔로워가 아니라고 뜬 경우 -> 실시간 API로 최신 팔로워(약 100명) 즉시 동기화
            if (!isFollow) {
                console.log(`[Webhook] User @${username} not in cache, syncing latest followers...`);
                try {
                    const accessToken = await getAccessToken();
                    if (accessToken) {
                        // 최신 팔로워 가져오기 (첫 페이지)
                        const data = await getFollowers(accessToken, 'me');
                        const latestFollowers = data.followers || [];

                        // DB 업데이트 (await로 확실히 저장될 때까지 대기)
                        await cacheFollowers(campaign.account_id || 1, latestFollowers);
                        console.log(`[Webhook] Synced ${latestFollowers.length} latest followers to DB`);

                        // 다시 검사 (DB에서)
                        isFollow = await isFollower(campaign.account_id || 1, userId);

                        // 만약 DB 검사가 느릴 것을 대비해 메모리에서도 확인
                        if (!isFollow) {
                            const found = latestFollowers.find(f => f.id === userId || f.username === username);
                            if (found) {
                                console.log(`[Webhook] Found @${username} in API response (Memory Check)`);
                                isFollow = true;
                            }
                        }
                    }
                } catch (e) {
                    console.error('[Webhook] Real-time follower sync failed:', e);
                }
            }

            followerStatus = isFollow ? 1 : 0;
            dmText = isFollow ? campaign.dm_follower : campaign.dm_non_follower;
        } else {
            dmText = campaign.dm_default;
        }

        if (!dmText) {
            console.log(`[Webhook] Campaign ${campaign.id}: no DM text configured`);
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

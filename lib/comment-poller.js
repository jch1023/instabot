// Comment Polling Engine
// Periodically checks Instagram posts for new comments and triggers DM sending
import { getSetting, setSetting, getAllCampaigns, createDmLog } from './db.js';
import { getMediaComments, getUserMedia, sendPrivateReply, renderDmMessage } from './instagram.js';

const POLL_INTERVAL = 30000; // 30 seconds
let pollingTimer = null;
let isPolling = false;
let lastPollResult = { status: 'idle', lastRun: null, error: null, processed: 0 };

/**
 * Get polling status
 */
export function getPollingStatus() {
    return {
        ...lastPollResult,
        isRunning: !!pollingTimer,
    };
}

/**
 * Start polling
 */
export function startPolling() {
    if (pollingTimer) return;
    console.log('[Poller] Starting comment polling (every 30s)...');
    pollingTimer = setInterval(pollOnce, POLL_INTERVAL);
    // Run immediately
    pollOnce();
}

/**
 * Stop polling
 */
export function stopPolling() {
    if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
        console.log('[Poller] Polling stopped.');
    }
    lastPollResult.status = 'stopped';
}

/**
 * Run a single poll cycle
 */
export async function pollOnce() {
    if (isPolling) return lastPollResult;
    isPolling = true;
    lastPollResult.status = 'running';

    const accessToken = getSetting('instagram_access_token');
    const igUserId = getSetting('ig_user_id');

    if (!accessToken || !igUserId) {
        lastPollResult = { status: 'error', error: 'No access token or IG user ID', lastRun: new Date().toISOString(), processed: 0, isRunning: !!pollingTimer };
        isPolling = false;
        return lastPollResult;
    }

    try {
        const campaigns = getAllCampaigns().filter(c => c.is_active && c.execution_mode === 'polling');
        if (campaigns.length === 0) {
            lastPollResult = { status: 'idle', error: null, lastRun: new Date().toISOString(), processed: 0, isRunning: !!pollingTimer };
            isPolling = false;
            return lastPollResult;
        }

        let totalProcessed = 0;

        for (const campaign of campaigns) {
            try {
                const processed = await pollCampaign(campaign, accessToken, igUserId);
                totalProcessed += processed;
            } catch (err) {
                console.error(`[Poller] Error polling campaign ${campaign.id}:`, err.message);
            }
        }

        lastPollResult = { status: 'ok', error: null, lastRun: new Date().toISOString(), processed: totalProcessed, isRunning: !!pollingTimer };
    } catch (err) {
        lastPollResult = { status: 'error', error: err.message, lastRun: new Date().toISOString(), processed: 0, isRunning: !!pollingTimer };
        console.error('[Poller] Poll error:', err.message);
    } finally {
        isPolling = false;
    }

    return lastPollResult;
}

/**
 * Poll a single campaign for new comments
 */
async function pollCampaign(campaign, accessToken, igUserId) {
    let processed = 0;
    const keywords = JSON.parse(campaign.keywords || '[]');

    // Determine which media to check
    let mediaIds = [];

    if (campaign.ig_media_id) {
        // Specific post
        mediaIds = [campaign.ig_media_id];
    } else {
        // All posts - check recent 10
        try {
            const media = await getUserMedia(accessToken, igUserId, 10);
            mediaIds = media.map(m => m.id);
        } catch (e) {
            console.error(`[Poller] Failed to get media for campaign ${campaign.id}:`, e.message);
            return 0;
        }
    }

    for (const mediaId of mediaIds) {
        try {
            const comments = await getMediaComments(accessToken, mediaId);

            for (const comment of comments) {
                // Check if we already processed this comment
                const processedKey = `processed_comment_${comment.id}`;
                if (getSetting(processedKey)) continue;

                // Check keyword match
                const commentText = (comment.text || '').toLowerCase();
                let matched = false;

                if (campaign.trigger_type === 'all') {
                    matched = true;
                } else if (campaign.trigger_type === 'keyword' && keywords.length > 0) {
                    matched = keywords.some(kw => commentText.includes(kw.toLowerCase()));
                }

                if (!matched) {
                    // Mark as processed even if not matched, so we don't check again
                    setSetting(processedKey, 'skipped');
                    continue;
                }

                // Determine DM text
                const username = comment.from?.username || 'user';
                let dmText = campaign.dm_default || '';

                if (campaign.check_follower) {
                    // TODO: implement follower check
                    dmText = campaign.dm_follower || campaign.dm_default || '';
                }

                dmText = renderDmMessage(dmText, { username, comment: comment.text });

                if (!dmText) {
                    setSetting(processedKey, 'no_dm_text');
                    continue;
                }

                // Send DM
                console.log(`[Poller] Sending DM to @${username} for comment "${comment.text.slice(0, 30)}..."`);

                try {
                    await sendPrivateReply(accessToken, comment.id, dmText, igUserId);

                    createDmLog({
                        campaign_id: campaign.id,
                        ig_user_id: comment.from?.id || '',
                        ig_username: username,
                        comment_id: comment.id,
                        comment_text: comment.text,
                        is_follower: false,
                        dm_sent: dmText,
                        status: 'sent',
                    });

                    setSetting(processedKey, 'sent');
                    processed++;
                    console.log(`[Poller] ✅ DM sent to @${username}`);
                } catch (dmErr) {
                    createDmLog({
                        campaign_id: campaign.id,
                        ig_user_id: comment.from?.id || '',
                        ig_username: username,
                        comment_id: comment.id,
                        comment_text: comment.text,
                        is_follower: false,
                        dm_sent: dmText,
                        status: 'failed',
                        error_message: dmErr.message,
                    });

                    setSetting(processedKey, 'failed');
                    console.error(`[Poller] ❌ DM failed to @${username}:`, dmErr.message);
                }
            }
        } catch (e) {
            // Comments API might fail for some posts
        }
    }

    return processed;
}

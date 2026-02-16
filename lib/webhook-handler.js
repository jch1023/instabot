// Webhook event handler - processes Instagram comment events
import { getAllCampaigns, createDmLog, isFollower, getSetting } from './db.js';
import { sendPrivateReply, renderDmMessage } from './instagram.js';

/**
 * Get the Instagram access token from DB settings or environment
 */
function getAccessToken() {
    // Try DB first, then environment variable
    const dbToken = getSetting('instagram_access_token');
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

    // Find matching active campaigns
    const campaigns = getAllCampaigns().filter(c => c.is_active);
    const results = [];

    for (const campaign of campaigns) {
        // Check if campaign targets this media or all media
        if (campaign.ig_media_id && campaign.ig_media_id !== mediaId) {
            continue;
        }

        // Check keyword trigger
        if (campaign.trigger_type === 'keyword') {
            const keywords = JSON.parse(campaign.keywords || '[]');
            const commentLower = commentText.toLowerCase();
            const matched = keywords.some(kw => commentLower.includes(kw.toLowerCase().trim()));
            if (!matched) {
                continue;
            }
        }

        // Determine which DM to send
        let dmText = '';
        let followerStatus = null;

        if (campaign.check_follower) {
            // Check follower status
            const isFollow = isFollower(campaign.account_id || 1, userId);
            followerStatus = isFollow;

            dmText = isFollow ? campaign.dm_follower : campaign.dm_non_follower;
        } else {
            dmText = campaign.dm_default;
        }

        if (!dmText) {
            console.log(`[Webhook] Campaign ${campaign.id}: no DM text configured`);
            continue;
        }

        // Render template variables
        dmText = renderDmMessage(dmText, { username, comment: commentText });

        // Send the DM via Private Reply
        try {
            const accessToken = getAccessToken();

            if (!accessToken) {
                throw new Error('No access token configured. Go to Settings page and enter your Instagram Access Token.');
            }

            await sendPrivateReply(accessToken, commentId, dmText);

            // Log success
            createDmLog({
                campaign_id: campaign.id,
                ig_user_id: userId,
                ig_username: username,
                comment_id: commentId,
                comment_text: commentText,
                is_follower: followerStatus,
                dm_sent: dmText,
                status: 'sent',
            });

            results.push({ campaignId: campaign.id, status: 'sent' });
            console.log(`[Webhook] ✅ DM sent to @${username} for campaign "${campaign.name}"`);
        } catch (error) {
            // Log failure
            createDmLog({
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

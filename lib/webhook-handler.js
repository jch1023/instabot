
// Webhook event handler - processes Instagram comment events
import {
    getAllCampaigns,
    createDmLog,
    getSetting,
    setSetting,
    cacheFollowers,
    setCachedFollowStatus,
    upsertPendingFollowRecheck,
    getPendingFollowRechecks,
    removePendingFollowRecheck,
    updateReplyRotationIndex,
} from './db.js';
import {
    sendPrivateReply,
    sendDirectMessage,
    sendTemplateMessagePayload,
    renderDmMessage,
    checkUserFollowStatus,
    replyToComment,
} from './instagram.js';

const FOLLOW_RECHECK_PAYLOAD = 'FOLLOW_RECHECK';
const FOLLOW_RECHECK_TITLE = '팔로우 했어요';
const HTTP_URL_PATTERN = /^https?:\/\//i;

function getCtaConfig(campaign, isFollow) {
    const legacyEnabled = campaign.cta_enabled !== 0;
    const legacyTitle = typeof campaign.cta_button_text === 'string'
        ? campaign.cta_button_text.trim()
        : FOLLOW_RECHECK_TITLE;
    const legacyPayload = (campaign.cta_payload || FOLLOW_RECHECK_PAYLOAD).trim() || FOLLOW_RECHECK_PAYLOAD;
    const hasFollowerEnabled = campaign.cta_follower_enabled === 0 || campaign.cta_follower_enabled === 1;
    const hasNonFollowerEnabled = campaign.cta_non_follower_enabled === 0 || campaign.cta_non_follower_enabled === 1;

    if (isFollow === true) {
        const followerPrompt = typeof campaign.cta_follower_prompt === 'string'
            ? campaign.cta_follower_prompt.trim()
            : '아래 버튼을 눌러 진행해주세요.';
        return {
            enabled: hasFollowerEnabled ? campaign.cta_follower_enabled === 1 : false,
            title: typeof campaign.cta_follower_button_text === 'string'
                ? campaign.cta_follower_button_text.trim()
                : '팔로워 확인했어요',
            payload: (campaign.cta_follower_payload || 'FOLLOWER_RECHECK').trim() || 'FOLLOWER_RECHECK',
            prompt: followerPrompt,
            legacyEnabled,
            legacyTitle,
            legacyPayload,
        };
    }

    const nonFollowerPrompt = typeof campaign.cta_non_follower_prompt === 'string'
        ? campaign.cta_non_follower_prompt.trim()
        : '아래 버튼을 눌러 팔로우 상태를 다시 확인해주세요.';
    return {
        enabled: hasNonFollowerEnabled ? campaign.cta_non_follower_enabled !== 0 : legacyEnabled,
        title: typeof campaign.cta_non_follower_button_text === 'string'
            ? campaign.cta_non_follower_button_text.trim()
            : legacyTitle,
        payload: (campaign.cta_non_follower_payload || legacyPayload).trim() || legacyPayload,
        prompt: nonFollowerPrompt,
        legacyEnabled,
        legacyTitle,
        legacyPayload,
    };
}

function isWebUrl(value) {
    return typeof value === 'string' && HTTP_URL_PATTERN.test(value.trim());
}

function getCtaReplyTitle(ctaConfig) {
    const titleText = typeof ctaConfig?.title === 'string' ? ctaConfig.title.trim() : '';
    return titleText || FOLLOW_RECHECK_TITLE;
}

function truncateTemplateText(value, maxLength) {
    const trimmed = (value || '').trim();
    if (trimmed.length <= maxLength) return trimmed;
    return `${trimmed.slice(0, Math.max(0, maxLength - 3))}...`;
}

function buildTemplateTextParts(baseMessage, ctaConfig) {
    const promptText = typeof ctaConfig?.prompt === 'string' ? ctaConfig.prompt.trim() : '';
    const merged = [baseMessage, promptText].filter(Boolean).join('\n').trim();
    const lines = merged.split('\n').map(line => line.trim()).filter(Boolean);
    const firstLine = lines[0] || merged || '\u200B';
    const rest = lines.slice(1).join(' ');

    return {
        title: truncateTemplateText(firstLine, 80) || '\u200B',
        subtitle: truncateTemplateText(rest, 80) || undefined,
        fullText: merged || baseMessage,
    };
}

async function sendSingleTemplateCtaMessage(accessToken, recipient, baseMessage, ctaConfig) {
    const payloadText = typeof ctaConfig?.payload === 'string' ? ctaConfig.payload.trim() : '';
    const isUrlCta = isWebUrl(payloadText);
    const { title, subtitle, fullText } = buildTemplateTextParts(baseMessage, ctaConfig);
    const ctaTitle = getCtaReplyTitle(ctaConfig) || '\u200B';

    const buttonData = isUrlCta
        ? {
            type: 'web_url',
            title: ctaTitle,
            url: payloadText,
        }
        : {
            type: 'postback',
            title: ctaTitle,
            payload: payloadText || FOLLOW_RECHECK_PAYLOAD,
        };

    const element = {
        title,
        buttons: [buttonData],
    };
    if (subtitle) element.subtitle = subtitle;

    await sendTemplateMessagePayload(accessToken, {
        recipient,
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'generic',
                    elements: [element],
                },
            },
        },
    });

    return {
        fullText,
        mode: isUrlCta ? 'web_url_template_inline' : 'button_template_inline',
        isUrlCta,
    };
}

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
        let isFollow = null;
        const accountId = campaign.account_id || 1;

        if (campaign.check_follower) {
            // [Follower Check Strategy]
            // 1) Always use live profile check
            // 2) If API is unavailable, mark as unknown (do not trust cache for follower=true)
            // 3) Persist checked result for next events
            // 4) Also mirror follower=true into followers_cache for admin list

            console.log(`[Webhook] Checking follower status for @${username} (ID: ${userId})...`);

            try {
                const accessToken = await getAccessToken();
                if (accessToken) {
                    const followCheck = await checkUserFollowStatus(accessToken, userId);
                    if (followCheck.isFollower === true) {
                        isFollow = true;
                        await setCachedFollowStatus(accountId, { id: userId, username, isFollower: true, source: 'comment_profile_check' });
                        cacheFollowers(accountId, [{ id: userId, username }]).catch(console.error);
                        console.log('[Webhook] ✅ Direct profile check: follower=true.');
                    } else if (followCheck.isFollower === false) {
                        isFollow = false;
                        await setCachedFollowStatus(accountId, { id: userId, username, isFollower: false, source: 'comment_profile_check' });
                        console.log('[Webhook] ℹ️ Direct profile check: follower=false.');
                    } else {
                        isFollow = null;
                        console.warn('[Webhook] ⚠️ Follow status unknown from live API.');
                    }
                } else {
                    console.warn('[Webhook] Missing access token for follower check.');
                    isFollow = null;
                }
            } catch (e) {
                console.error('[Webhook] Follower check error:', e.message, e.code ? `(code: ${e.code})` : '');
                isFollow = null;
            }

            if (isFollow === true) {
                followerStatus = 1;
                dmText = campaign.dm_follower;
            } else if (isFollow === false) {
                followerStatus = 0;
                dmText = campaign.dm_non_follower;
            } else {
                followerStatus = null;
                // Unknown state: prefer dm_default, then fallback to non-follower message.
                dmText = campaign.dm_default || campaign.dm_non_follower || '';
            }
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
        const ctaConfig = getCtaConfig(campaign, isFollow);
        const shouldAttachFollowCta = campaign.check_follower && ctaConfig.enabled;
        let outboundDmText = dmText;
        let followCtaMode = 'none';
        let isUrlCta = false;

        // Send the DM via Private Reply
        try {
            const accessToken = await getAccessToken();

            if (!accessToken) {
                throw new Error('No access token configured.');
            }

            if (shouldAttachFollowCta) {
                const templateResult = await sendSingleTemplateCtaMessage(
                    accessToken,
                    { id: userId },
                    dmText,
                    ctaConfig
                );
                outboundDmText = templateResult.fullText;
                followCtaMode = templateResult.mode;
                isUrlCta = templateResult.isUrlCta;
            } else {
                await sendPrivateReply(accessToken, commentId, outboundDmText);
            }

            if (shouldAttachFollowCta) {
                const ctaReplyTitle = getCtaReplyTitle(ctaConfig);

                // Follow recheck queue is only meaningful for non-URL CTA.
                if (!isUrlCta) {
                    await upsertPendingFollowRecheck(accountId, {
                        igUserId: userId,
                        igUsername: username,
                        campaignId: campaign.id,
                        commentId,
                        commentText,
                        ctaButtonText: ctaReplyTitle,
                        ctaPayload: ctaConfig.payload,
                    });
                }
            }

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
                dm_sent: outboundDmText,
                status: 'sent',
            });

            results.push({
                action: 'DM_REPLY',
                trigger_comment: commentText,
                campaign_name: campaign.name || 'Campaign #' + campaign.id,
                recipient: username,
                dm_content: outboundDmText,
                is_follower: followerStatus,
                follow_cta_mode: shouldAttachFollowCta ? followCtaMode : 'none',
                follow_cta_template_type: null,
                status: 'success'
            });
            console.log(`[Webhook] ✅ DM sent to @${username} for campaign "${campaign.name}"`);

            // 대댓글 자동 달기 (Auto Reply to Comment)
            if (campaign.reply_enabled) {
                try {
                    const activeReplies = [];
                    for (let i = 1; i <= 5; i++) {
                        const replyTemplate = campaign[`reply_text_${i}`];
                        if (campaign[`reply_active_${i}`] && typeof replyTemplate === 'string' && replyTemplate.trim()) {
                            activeReplies.push(campaign[`reply_text_${i}`]);
                        }
                    }
                    if (activeReplies.length > 0) {
                        const idx = (campaign.reply_rotation_index || 0) % activeReplies.length;
                        let replyText = activeReplies[idx];
                        replyText = renderDmMessage(replyText, { username, comment: commentText });
                        await replyToComment(accessToken, commentId, replyText);
                        await updateReplyRotationIndex(campaign.id, (campaign.reply_rotation_index || 0) + 1);
                        console.log(`[Webhook] 💬 대댓글 작성 완료 (Template #${idx + 1}): "${replyText.substring(0, 30)}..."`);
                    }
                } catch (replyError) {
                    console.error(`[Webhook] ⚠️ 대댓글 실패 (DM은 성공):`, replyError.message);
                }
            }
        } catch (error) {
            // Log failure
            await createDmLog({
                campaign_id: campaign.id,
                ig_user_id: userId,
                ig_username: username,
                comment_id: commentId,
                comment_text: commentText,
                is_follower: followerStatus,
                dm_sent: outboundDmText,
                status: 'failed',
                error_message: error.message,
            });

            results.push({ campaignId: campaign.id, status: 'failed', error: error.message });
            console.error(`[Webhook] ❌ DM failed for @${username}:`, error.message);
        }
    }

    return { processed: true, results };
}

function getMessagingText(event) {
    return event?.message?.text || '';
}

function getQuickReplyPayload(event) {
    return event?.message?.quick_reply?.payload || event?.postback?.payload || '';
}

/**
 * Process incoming DM event to keep follower status cache warm.
 * This follows the same contact-centric pattern used by chatbot platforms.
 */
export async function handleMessagingEvent(event) {
    const senderId = event?.sender?.id || event?.from?.id;
    if (!senderId) return { processed: false, reason: 'missing_sender_id' };

    const accountId = 1;
    const payload = getQuickReplyPayload(event);
    const text = getMessagingText(event).trim();

    try {
        const accessToken = await getAccessToken();
        if (!accessToken) return { processed: false, reason: 'missing_access_token' };

        const pending = await getPendingFollowRechecks(accountId, senderId, 5);
        if (pending.length === 0) {
            return { processed: true, reason: 'no_pending_follow_recheck' };
        }

        const validPayloads = new Set(pending.map(p => (p.cta_payload || FOLLOW_RECHECK_PAYLOAD).trim()).filter(Boolean));
        const validTitles = new Set(
            pending
                .map(p => (typeof p.cta_button_text === 'string' ? p.cta_button_text.trim() : FOLLOW_RECHECK_TITLE))
                .filter(Boolean)
        );
        const isRecheckTrigger =
            validPayloads.has(payload) ||
            validTitles.has(text) ||
            /팔로우/.test(text);

        if (!isRecheckTrigger) {
            return { processed: true, reason: 'message_without_recheck_trigger', pending: pending.length };
        }

        const followCheck = await checkUserFollowStatus(accessToken, senderId);
        if (typeof followCheck.isFollower === 'boolean') {
            await setCachedFollowStatus(accountId, {
                id: senderId,
                username: followCheck.profile?.username || null,
                isFollower: followCheck.isFollower,
                source: 'dm_event_profile_check',
            });
            if (followCheck.isFollower) {
                cacheFollowers(accountId, [{ id: senderId, username: followCheck.profile?.username || null }]).catch(console.error);
            }
        } else {
            return { processed: true, isFollower: null, reason: 'follow_status_unknown' };
        }

        const results = [];
        for (const item of pending) {
            if (!item.is_active || !item.check_follower) {
                await removePendingFollowRecheck(item.id);
                results.push({ campaignId: item.campaign_id, status: 'removed_inactive_or_invalid' });
                continue;
            }

            const rawMessage = followCheck.isFollower ? item.dm_follower : item.dm_non_follower || item.dm_default;
            if (!rawMessage) {
                results.push({ campaignId: item.campaign_id, status: 'skipped_no_message' });
                continue;
            }

            const renderedMessage = renderDmMessage(rawMessage, {
                username: followCheck.profile?.username || item.ig_username || 'user',
                comment: item.comment_text || '',
            });
            const ctaConfig = getCtaConfig(item, followCheck.isFollower === true);
            const shouldAttachFollowCta = item.check_follower && ctaConfig.enabled;
            let outboundMessage = renderedMessage;
            let followCtaMode = 'none';
            let isUrlCta = false;

            try {
                if (shouldAttachFollowCta) {
                    const templateResult = await sendSingleTemplateCtaMessage(
                        accessToken,
                        { id: senderId },
                        renderedMessage,
                        ctaConfig
                    );
                    outboundMessage = templateResult.fullText;
                    followCtaMode = templateResult.mode;
                    isUrlCta = templateResult.isUrlCta;
                } else {
                    await sendDirectMessage(accessToken, senderId, outboundMessage);
                }

                const ctaReplyTitle = getCtaReplyTitle(ctaConfig);

                // Keep recheck queue alive for non-follower postback CTA.
                if (shouldAttachFollowCta && followCheck.isFollower === false && !isUrlCta) {
                    await upsertPendingFollowRecheck(accountId, {
                        igUserId: senderId,
                        igUsername: followCheck.profile?.username || item.ig_username || null,
                        campaignId: item.campaign_id,
                        commentId: item.comment_id || null,
                        commentText: item.comment_text || '',
                        ctaButtonText: ctaReplyTitle,
                        ctaPayload: ctaConfig.payload,
                    });
                }

                await createDmLog({
                    campaign_id: item.campaign_id,
                    ig_user_id: senderId,
                    ig_username: followCheck.profile?.username || item.ig_username || 'unknown',
                    comment_id: item.comment_id || null,
                    comment_text: item.comment_text || '',
                    is_follower: followCheck.isFollower ? 1 : 0,
                    dm_sent: outboundMessage,
                    status: 'sent',
                });

                if (followCheck.isFollower === true) {
                    await removePendingFollowRecheck(item.id);
                }

                results.push({
                    campaignId: item.campaign_id,
                    status: 'sent',
                    is_follower: followCheck.isFollower ? 1 : 0,
                    removed_pending: followCheck.isFollower === true,
                    follow_cta_mode: shouldAttachFollowCta ? followCtaMode : 'none',
                    follow_cta_template_type: null,
                });
            } catch (sendError) {
                await createDmLog({
                    campaign_id: item.campaign_id,
                    ig_user_id: senderId,
                    ig_username: followCheck.profile?.username || item.ig_username || 'unknown',
                    comment_id: item.comment_id || null,
                    comment_text: item.comment_text || '',
                    is_follower: followCheck.isFollower ? 1 : 0,
                    dm_sent: outboundMessage,
                    status: 'failed',
                    error_message: sendError.message,
                });

                results.push({
                    campaignId: item.campaign_id,
                    status: 'failed',
                    error: sendError.message,
                });
            }
        }

        return {
            processed: true,
            isFollower: followCheck.isFollower,
            trigger: payload || text || null,
            pendingCount: pending.length,
            results,
        };
    } catch (error) {
        console.error('[Webhook] Messaging follow-sync error:', error.message);
        return { processed: false, reason: error.message };
    }
}

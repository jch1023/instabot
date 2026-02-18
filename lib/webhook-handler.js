
// Webhook event handler - processes Instagram comment events
import {
    getAllCampaigns,
    createDmLog,
    getSetting,
    setSetting,
    cacheFollowers,
    getCachedFollowStatus,
    setCachedFollowStatus,
    upsertPendingFollowRecheck,
    getPendingFollowRechecks,
    removePendingFollowRecheck,
} from './db.js';
import {
    sendPrivateReply,
    sendDirectMessage,
    sendTemplateMessagePayload,
    renderDmMessage,
    checkUserFollowStatus,
} from './instagram.js';

const FOLLOW_RECHECK_PAYLOAD = 'FOLLOW_RECHECK';
const FOLLOW_RECHECK_TITLE = '팔로우 했어요';
const HTTP_URL_PATTERN = /^https?:\/\//i;

function getCtaConfig(campaign, isFollow) {
    const legacyEnabled = campaign.cta_enabled !== 0;
    const legacyTitle = (campaign.cta_button_text || FOLLOW_RECHECK_TITLE).trim() || FOLLOW_RECHECK_TITLE;
    const legacyPayload = (campaign.cta_payload || FOLLOW_RECHECK_PAYLOAD).trim() || FOLLOW_RECHECK_PAYLOAD;
    const hasFollowerEnabled = campaign.cta_follower_enabled === 0 || campaign.cta_follower_enabled === 1;
    const hasNonFollowerEnabled = campaign.cta_non_follower_enabled === 0 || campaign.cta_non_follower_enabled === 1;

    if (isFollow === true) {
        return {
            enabled: hasFollowerEnabled ? campaign.cta_follower_enabled === 1 : false,
            title: (campaign.cta_follower_button_text || '팔로워 확인했어요').trim() || '팔로워 확인했어요',
            payload: (campaign.cta_follower_payload || 'FOLLOWER_RECHECK').trim() || 'FOLLOWER_RECHECK',
            legacyEnabled,
            legacyTitle,
            legacyPayload,
        };
    }

    return {
        enabled: hasNonFollowerEnabled ? campaign.cta_non_follower_enabled !== 0 : legacyEnabled,
        title: (campaign.cta_non_follower_button_text || legacyTitle).trim() || legacyTitle,
        payload: (campaign.cta_non_follower_payload || legacyPayload).trim() || legacyPayload,
        legacyEnabled,
        legacyTitle,
        legacyPayload,
    };
}

function isWebUrl(value) {
    return typeof value === 'string' && HTTP_URL_PATTERN.test(value.trim());
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
            // 1) Use recent cached status (true/false)
            // 2) If cache miss, check `is_user_follow_business` for this user directly
            // 3) Persist checked result for next events
            // 4) Also mirror follower=true into followers_cache for admin list

            console.log(`[Webhook] Checking follower status for @${username} (ID: ${userId})...`);

            try {
                const recentCached = await getCachedFollowStatus(accountId, userId, 86400);
                if (recentCached !== null) {
                    isFollow = recentCached;
                    console.log(`[Webhook] ✅ Cached status hit: follower=${isFollow}`);
                }

                if (isFollow === null) {
                    console.log('[Webhook] Not in DB. Checking profile follow status...');

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
                            const staleCached = await getCachedFollowStatus(accountId, userId, 0);
                            if (staleCached !== null) {
                                isFollow = staleCached;
                                console.log(`[Webhook] ⚠️ API unknown. Falling back to stale cache: follower=${isFollow}`);
                            } else {
                                isFollow = null;
                                console.log('[Webhook] ⚠️ Follow status unavailable and no cache.');
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[Webhook] Follower check error:', e.message, e.code ? `(code: ${e.code})` : '');
                const staleCached = await getCachedFollowStatus(accountId, userId, 0);
                isFollow = staleCached !== null ? staleCached : null;
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
        const quickReplies = shouldAttachFollowCta
            ? [
                {
                    content_type: 'text',
                    title: ctaConfig.title,
                    payload: ctaConfig.payload,
                },
            ]
            : [];
        const outboundDmText = dmText;

        // Send the DM via Private Reply
        try {
            const accessToken = await getAccessToken();
            let followCtaMode = 'none';
            let followCtaTemplateType = null;

            if (!accessToken) {
                throw new Error('No access token configured.');
            }

            await sendPrivateReply(accessToken, commentId, outboundDmText);

            if (shouldAttachFollowCta) {
                const isUrlCta = isWebUrl(ctaConfig.payload);
                const ctaPrompt = isUrlCta
                    ? '아래 버튼을 눌러 상세 페이지로 이동해주세요.'
                    : '아래 버튼을 눌러 팔로우 상태를 다시 확인해주세요.';

                // Follow recheck queue is only meaningful for postback-style CTA.
                if (!isUrlCta) {
                    await upsertPendingFollowRecheck(accountId, {
                        igUserId: userId,
                        igUsername: username,
                        campaignId: campaign.id,
                        commentId,
                        commentText,
                        ctaButtonText: ctaConfig.title,
                        ctaPayload: ctaConfig.payload,
                    });
                }

                try {
                    const buttonData = isUrlCta
                        ? {
                            type: 'web_url',
                            title: ctaConfig.title,
                            url: ctaConfig.payload,
                        }
                        : {
                            type: 'postback',
                            title: ctaConfig.title,
                            payload: ctaConfig.payload,
                        };

                    const buttonMessageData = {
                        recipient: { id: userId },
                        message: {
                            attachment: {
                                type: 'template',
                                payload: {
                                    template_type: 'generic',
                                    elements: [
                                        {
                                            title: ctaPrompt,
                                            subtitle: '버튼을 눌러 진행해주세요.',
                                            buttons: [buttonData],
                                        },
                                    ],
                                },
                            },
                        },
                    };

                    await sendTemplateMessagePayload(accessToken, buttonMessageData);
                    followCtaMode = isUrlCta ? 'web_url_template' : 'button_template';
                    followCtaTemplateType = 'generic';
                } catch (templateError) {
                    console.warn('[Webhook] CTA template send skipped:', templateError.message);

                    if (isUrlCta) {
                        try {
                            await sendDirectMessage(
                                accessToken,
                                userId,
                                `버튼이 보이지 않으면 아래 링크를 눌러주세요:\n${ctaConfig.payload}`
                            );
                            followCtaMode = 'url_text_fallback';
                        } catch (urlFallbackError) {
                            console.warn('[Webhook] CTA URL text fallback send skipped:', urlFallbackError.message);
                        }
                    } else {
                        try {
                            await sendDirectMessage(
                                accessToken,
                                userId,
                                '아래 버튼을 눌러 팔로우 상태를 다시 확인해주세요.',
                                { quickReplies }
                            );
                            followCtaMode = 'quick_reply';
                        } catch (quickReplyError) {
                            console.warn('[Webhook] CTA quick reply send skipped:', quickReplyError.message);
                            await sendDirectMessage(
                                accessToken,
                                userId,
                                `아래 문구를 DM으로 답장해주세요:\n"${ctaConfig.title}"`
                            );
                            followCtaMode = 'text_reply_fallback';
                        }
                    }
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
                follow_cta_template_type: followCtaTemplateType,
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
        const validTitles = new Set(pending.map(p => (p.cta_button_text || FOLLOW_RECHECK_TITLE).trim()).filter(Boolean));
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

            try {
                await sendDirectMessage(accessToken, senderId, renderedMessage);

                await createDmLog({
                    campaign_id: item.campaign_id,
                    ig_user_id: senderId,
                    ig_username: followCheck.profile?.username || item.ig_username || 'unknown',
                    comment_id: item.comment_id || null,
                    comment_text: item.comment_text || '',
                    is_follower: followCheck.isFollower ? 1 : 0,
                    dm_sent: renderedMessage,
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
                });
            } catch (sendError) {
                await createDmLog({
                    campaign_id: item.campaign_id,
                    ig_user_id: senderId,
                    ig_username: followCheck.profile?.username || item.ig_username || 'unknown',
                    comment_id: item.comment_id || null,
                    comment_text: item.comment_text || '',
                    is_follower: followCheck.isFollower ? 1 : 0,
                    dm_sent: renderedMessage,
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

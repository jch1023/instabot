// Instagram Graph API wrapper
// Uses Meta's official Instagram Messaging API for DMs and comment monitoring

const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0';
const GRAPH_API_FALLBACK_BASE = 'https://graph.facebook.com/v21.0';

/**
 * Send a Private Reply (DM) to a comment
 * Endpoint: POST /<IG-USER-ID>/messages
 * Ref: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging#private-replies
 */
export async function sendPrivateReply(accessToken, commentId, message, igUserId = 'me') {
    const url = `${GRAPH_API_BASE}/${igUserId}/messages`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: {
                comment_id: commentId,
            },
            message: {
                text: message,
            },
            access_token: accessToken,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || `Failed to send private reply (HTTP ${response.status})`);
    }

    return data;
}

/**
 * Send a private reply with optional quick replies
 */
export async function sendPrivateReplyWithOptions(accessToken, commentId, message, options = {}, igUserId = 'me') {
    const url = `${GRAPH_API_BASE}/${igUserId}/messages`;
    const messageBody = {
        text: message,
    };

    if (Array.isArray(options.quickReplies) && options.quickReplies.length > 0) {
        messageBody.quick_replies = options.quickReplies;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: {
                comment_id: commentId,
            },
            message: messageBody,
            access_token: accessToken,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || `Failed to send private reply (HTTP ${response.status})`);
    }

    return data;
}

/**
 * Send a direct DM to a user id
 */
export async function sendDirectMessage(accessToken, recipientId, message, options = {}, igUserId = 'me') {
    const url = `${GRAPH_API_BASE}/${igUserId}/messages`;
    const messageBody = {
        text: message,
    };

    if (Array.isArray(options.quickReplies) && options.quickReplies.length > 0) {
        messageBody.quick_replies = options.quickReplies;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: {
                id: recipientId,
            },
            message: messageBody,
            access_token: accessToken,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || `Failed to send direct message (HTTP ${response.status})`);
    }

    return data;
}

/**
 * Send a full template payload message.
 * Expected shape: { recipient: { id }, message: { attachment: { ... } } }
 */
export async function sendTemplateMessagePayload(accessToken, messageData, igUserId = 'me') {
    const url = `${GRAPH_API_BASE}/${igUserId}/messages`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ...messageData,
            access_token: accessToken,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || `Failed to send template payload (HTTP ${response.status})`);
    }

    return data;
}

/**
 * Send a button-template DM to a user id.
 * Instagram renders this as a visible CTA button in supported clients.
 */
export async function sendDirectButtonTemplate(accessToken, recipientId, text, button = {}, igUserId = 'me') {
    const rawTitle = typeof button.title === 'string' ? button.title.trim() : '팔로우 했어요';
    const title = rawTitle || '\u200B';
    const payload = (button.payload || 'FOLLOW_RECHECK').trim() || 'FOLLOW_RECHECK';
    const templateText = (text || '아래 버튼을 눌러 진행해주세요.').trim();
    const isWebUrlButton = /^https?:\/\//i.test(payload);
    const ctaButton = isWebUrlButton
        ? {
            type: 'web_url',
            url: payload,
            title,
        }
        : {
            type: 'postback',
            payload,
            title,
        };

    const buttonMessageData = {
        recipient: { id: recipientId },
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'generic',
                    elements: [
                        {
                            title: templateText,
                            subtitle: '버튼을 눌러 진행해주세요.',
                            buttons: [ctaButton],
                        },
                    ],
                },
            },
        },
    };
    const payloadShape = buttonMessageData?.message?.attachment?.payload;
    if (payloadShape?.generic) {
        throw new Error('Invalid CTA payload: payload.generic wrapper is not allowed');
    }
    if (payloadShape?.template_type !== 'generic' || !Array.isArray(payloadShape?.elements)) {
        throw new Error('Invalid CTA payload shape: expected template_type=generic with elements array');
    }

    const data = await sendTemplateMessagePayload(accessToken, buttonMessageData, igUserId);

    return {
        ...data,
        cta_type: isWebUrlButton ? 'web_url' : 'postback',
        template_type: payloadShape.template_type,
    };
}

/**
 * Get the authenticated user's Instagram profile (me)
 */
export async function getMyProfile(accessToken) {
    const url = `${GRAPH_API_BASE}/me?fields=id,username,name,profile_picture_url,followers_count,media_count&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch profile');
    }

    return data;
}

/**
 * Get user's Instagram media (posts/reels)
 */
export async function getUserMedia(accessToken, igUserId = 'me', limit = 20) {
    const url = `${GRAPH_API_BASE}/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,permalink&limit=${limit}&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch media');
    }

    return data.data || [];
}

/**
 * Get comments on a specific media
 */
export async function getMediaComments(accessToken, mediaId) {
    const url = `${GRAPH_API_BASE}/${mediaId}/comments?fields=id,text,from,timestamp&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch comments');
    }

    return data.data || [];
}

/**
 * Get user profile info
 */
export async function getUserProfile(accessToken, igUserId, fields = null) {
    // Default to fields that are safe for third-party user lookup.
    const defaultFields = 'id,username,is_user_follow_business,is_business_follow_user';
    const fieldsToFetch = fields || defaultFields;
    return fetchUserProfileByBase(accessToken, igUserId, fieldsToFetch, GRAPH_API_BASE);
}

async function fetchUserProfileByBase(accessToken, igUserId, fieldsToFetch, apiBase) {
    const url = `${apiBase}/${igUserId}?fields=${fieldsToFetch}&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        console.error(`[Instagram API] Failed to fetch profile from ${apiBase}:`, data.error);
        const error = new Error(data.error?.message || 'Failed to fetch user profile');
        error.code = data.error?.code;
        error.subcode = data.error?.error_subcode;
        error.apiBase = apiBase;
        throw error;
    }

    return data;
}

function toBooleanOrNull(value) {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return null;
}

/**
 * Check whether a target user follows the authenticated business account.
 * Uses `is_user_follow_business` on the target IG user node.
 */
export async function checkUserFollowStatus(accessToken, igUserId) {
    const followFields = 'id,username,is_user_follow_business,is_business_follow_user';
    let profile;
    try {
        profile = await fetchUserProfileByBase(accessToken, igUserId, followFields, GRAPH_API_BASE);
    } catch (err) {
        // Some apps/tokens still resolve user nodes via graph.facebook.com.
        if (err.code === 100 || err.code === 803) {
            profile = await fetchUserProfileByBase(accessToken, igUserId, followFields, GRAPH_API_FALLBACK_BASE);
        } else {
            throw err;
        }
    }

    return {
        profile,
        isFollower: toBooleanOrNull(profile?.is_user_follow_business),
    };
}

/**
 * Exchange short-lived token for long-lived token
 */
export async function getLongLivedToken(appId, appSecret, shortLivedToken) {
    const url = `${GRAPH_API_BASE}/oauth/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortLivedToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to get long-lived token');
    }

    return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
    };
}

/**
 * Refresh a long-lived token
 */
export async function refreshToken(accessToken) {
    const url = `${GRAPH_API_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to refresh token');
    }

    return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
    };
}

/**
 * Replace template variables in DM message
 * Supported: {username}, {comment}
 */
export function renderDmMessage(template, vars = {}) {
    let message = template;
    if (vars.username) message = message.replace(/\{username\}/g, vars.username);
    if (vars.comment) message = message.replace(/\{comment\}/g, vars.comment);
    return message;
}

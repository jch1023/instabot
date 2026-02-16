// Instagram Graph API wrapper
// Uses Meta's official Instagram Messaging API for DMs and comment monitoring

const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0';

/**
 * Send a Private Reply (DM) to a comment
 * Endpoint: POST /<IG-USER-ID>/messages
 * Ref: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging#private-replies
 */
export async function sendPrivateReply(accessToken, commentId, message, igUserId = 'me') {
    const url = `${GRAPH_API_BASE}/${igUserId}/messages`;

    const body = {
        recipient: {
            comment_id: commentId,
        },
        message: {
            text: message,
        },
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ...body,
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
export async function getUserProfile(accessToken, igUserId) {
    const url = `${GRAPH_API_BASE}/${igUserId}?fields=id,username,name,profile_picture_url,followers_count,media_count&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch user profile');
    }

    return data;
}

/**
 * Get followers list (paginated) - for follower check feature
 */
export async function getFollowers(accessToken, igUserId = 'me', after = null) {
    let url = `${GRAPH_API_BASE}/${igUserId}/followers?fields=id,username&limit=100&access_token=${accessToken}`;
    if (after) {
        url += `&after=${after}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch followers');
    }

    return {
        followers: data.data || [],
        paging: data.paging || null,
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

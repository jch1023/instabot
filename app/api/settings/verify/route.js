import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '../../../../lib/db.js';
import { getMyProfile } from '../../../../lib/instagram.js';

/**
 * GET /api/settings/verify - Verify Instagram connection by testing the access token
 */
export async function GET() {
    try {
        const accessToken = getSetting('instagram_access_token');

        if (!accessToken) {
            return NextResponse.json({
                connected: false,
                error: 'No access token configured',
            });
        }

        // Try to fetch profile with the token
        const profile = await getMyProfile(accessToken);

        // Save IG user info to settings for later use
        if (profile.id) setSetting('ig_user_id', profile.id);
        if (profile.username) setSetting('ig_username', profile.username);

        return NextResponse.json({
            connected: true,
            profile: {
                id: profile.id,
                username: profile.username,
                name: profile.name,
                profilePicture: profile.profile_picture_url,
                followersCount: profile.followers_count,
                mediaCount: profile.media_count,
            },
        });
    } catch (error) {
        return NextResponse.json({
            connected: false,
            error: error.message,
        });
    }
}

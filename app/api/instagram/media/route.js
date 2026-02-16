import { NextResponse } from 'next/server';
import { getSetting } from '../../../../lib/db.js';
import { getUserMedia } from '../../../../lib/instagram.js';

/**
 * GET /api/instagram/media - Fetch user's Instagram posts
 */
export async function GET() {
    try {
        const accessToken = getSetting('instagram_access_token');
        if (!accessToken) {
            return NextResponse.json({ error: 'No access token' }, { status: 401 });
        }

        const igUserId = getSetting('ig_user_id') || 'me';
        const media = await getUserMedia(accessToken, igUserId, 25);

        return NextResponse.json(media);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

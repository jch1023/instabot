import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db.js';
import { getMediaComments } from '@/lib/instagram.js';

/**
 * GET /api/instagram/media/[mediaId]/comments - Fetch comments on a specific post
 */
export async function GET(request, { params }) {
    try {
        const { mediaId } = await params;
        const accessToken = getSetting('instagram_access_token');
        if (!accessToken) {
            return NextResponse.json({ error: 'No access token' }, { status: 401 });
        }

        const comments = await getMediaComments(accessToken, mediaId);
        return NextResponse.json(comments);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db.js';
import { checkUserFollowStatus } from '@/lib/instagram.js';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    try {
        const accessToken = await getSetting('instagram_access_token');
        if (!accessToken) {
            return NextResponse.json({ error: 'No access token found' }, { status: 500 });
        }

        const result = await checkUserFollowStatus(accessToken, userId);
        const profile = result.profile || {};

        return NextResponse.json({
            success: true,
            userId,
            is_user_follow_business: result.isFollower,
            is_business_follow_user: profile.is_business_follow_user ?? null,
            full_profile: profile
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}

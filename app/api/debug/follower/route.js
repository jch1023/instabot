
import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db.js';
import { getUserProfile } from '@/lib/instagram.js';

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

        const profile = await getUserProfile(accessToken, userId);

        return NextResponse.json({
            success: true,
            userId,
            is_user_follow_business: profile.is_user_follow_business,
            is_business_follow_user: profile.is_business_follow_user,
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

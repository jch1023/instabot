
import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db.js';

export async function POST() {
    try {
        const accessToken = await getSetting('instagram_access_token');
        if (!accessToken) {
            return NextResponse.json({ error: 'No access token found' }, { status: 500 });
        }

        return NextResponse.json({
            success: false,
            removed: true,
            message: 'Follower list sync is disabled. Follower status is now checked per-user from webhook interactions.'
        });

    } catch (error) {
        console.error('Follower sync error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

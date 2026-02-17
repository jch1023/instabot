
import { NextResponse } from 'next/server';
import { getSetting, cacheFollowers } from '@/lib/db.js';
import { getFollowers, getMyProfile } from '@/lib/instagram.js';

export async function POST() {
    try {
        const accessToken = await getSetting('instagram_access_token');
        if (!accessToken) {
            return NextResponse.json({ error: 'Instagram Access Token not found' }, { status: 400 });
        }

        // 1. Get my IG User ID
        const profile = await getMyProfile(accessToken);
        const myId = profile.id;

        // 2. Fetch followers (fetch up to 500 for now to avoid timeout)
        let allFollowers = [];
        let after = null;
        let pageCount = 0;
        const MAX_PAGES = 5; // 5 pages * 100 = 500 followers limit per run

        do {
            const data = await getFollowers(accessToken, myId, after);
            const followers = data.followers || [];
            allFollowers = [...allFollowers, ...followers];

            after = data.paging?.cursors?.after;
            pageCount++;
        } while (after && pageCount < MAX_PAGES);

        // 3. Save to DB
        // Account ID 1 is default for single user system
        await cacheFollowers(1, allFollowers);

        return NextResponse.json({
            success: true,
            count: allFollowers.length,
            message: `Synced ${allFollowers.length} followers.`
        });

    } catch (error) {
        console.error('[API] Failed to sync followers:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

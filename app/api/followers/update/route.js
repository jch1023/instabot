
import { NextResponse } from 'next/server';
import { getSetting, cacheFollowers } from '@/lib/db.js';
import { getFollowers } from '@/lib/instagram.js';

export async function POST(request) {
    // 1. 보안 체크 (로그인 여부 등) - 필요 시 추가

    // 2. 요청 파라미터 (다음 페이지용 커서)
    let body = {};
    try {
        body = await request.json();
    } catch { }
    const { after } = body;

    try {
        const accessToken = await getSetting('instagram_access_token');
        if (!accessToken) {
            return NextResponse.json({ error: 'No access token found' }, { status: 500 });
        }

        // 3. 인스타그램 API 호출 (한 페이지, 약 100명)
        const accountId = 1; // 단일 계정 가정
        // getFollowers 함수는 { followers: [], paging: { cursors: { after: '...' } } } 반환
        const data = await getFollowers(accessToken, 'me', after);
        const followers = data.followers || [];
        const nextCursor = data.paging?.cursors?.after || null;

        // 4. DB에 저장 (Duplicate Key -> Update 처리됨)
        if (followers.length > 0) {
            await cacheFollowers(accountId, followers);
        }

        // 5. 결과 반환 (다음 커서 포함)
        return NextResponse.json({
            success: true,
            count: followers.length,
            next_cursor: nextCursor,
            message: `Synced ${followers.length} followers.`
        });

    } catch (error) {
        console.error('Follower sync error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

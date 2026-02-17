
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db.js'; // 공통 DB 연결 사용

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';

    try {
        let query;
        let countQuery;

        if (search) {
            query = await sql`
                SELECT * FROM followers_cache 
                WHERE ig_username ILIKE ${'%' + search + '%'}
                ORDER BY cached_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
            countQuery = await sql`
                SELECT count(*) FROM followers_cache 
                WHERE ig_username ILIKE ${'%' + search + '%'}
            `;
        } else {
            query = await sql`
                SELECT * FROM followers_cache 
                ORDER BY cached_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
            countQuery = await sql`
                SELECT count(*) FROM followers_cache
            `;
        }

        return NextResponse.json({
            success: true,
            followers: query.rows,
            total: parseInt(countQuery.rows[0].count)
        });
    } catch (e) {
        console.error('Followers API error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

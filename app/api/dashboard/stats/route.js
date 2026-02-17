import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/db.js';

/**
 * GET /api/dashboard/stats - Get dashboard statistics
 */
export async function GET() {
    try {
        const stats = await getDashboardStats();
        return NextResponse.json(stats);
    } catch (error) {
        console.error('[API] Error fetching stats:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

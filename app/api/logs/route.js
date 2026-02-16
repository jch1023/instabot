import { NextResponse } from 'next/server';
import { getDmLogs } from '../../../lib/db.js';

/**
 * GET /api/logs - Get DM logs with optional filters
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || null;
        const campaignId = searchParams.get('campaign_id') || null;
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        const logs = getDmLogs({ status, campaignId, limit, offset });
        return NextResponse.json(logs);
    } catch (error) {
        console.error('[API] Error fetching logs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


import { NextResponse } from 'next/server';
import { getWebhookLogs } from '@/lib/db.js';

/**
 * GET /api/webhook/logs - Fetch recent webhook logs
 */
export async function GET() {
    try {
        const logs = await getWebhookLogs(100);
        return NextResponse.json(logs);
    } catch (error) {
        console.error('[API] Error fetching webhook logs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

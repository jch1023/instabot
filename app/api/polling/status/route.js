import { NextResponse } from 'next/server';
import { startPolling, stopPolling, pollOnce, getPollingStatus } from '../../../../lib/comment-poller.js';

/**
 * GET /api/polling/status - Get polling status
 */
export async function GET() {
    return NextResponse.json(getPollingStatus());
}

/**
 * POST /api/polling/status - Control polling (start/stop/poll-once)
 */
export async function POST(request) {
    try {
        const { action } = await request.json();

        switch (action) {
            case 'start':
                startPolling();
                return NextResponse.json({ success: true, message: 'Polling started', ...getPollingStatus() });
            case 'stop':
                stopPolling();
                return NextResponse.json({ success: true, message: 'Polling stopped', ...getPollingStatus() });
            case 'poll':
                const result = await pollOnce();
                return NextResponse.json({ success: true, message: 'Poll complete', ...result });
            default:
                return NextResponse.json({ error: 'Invalid action. Use: start, stop, poll' }, { status: 400 });
        }
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

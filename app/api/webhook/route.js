import { NextResponse } from 'next/server';
import { handleCommentEvent } from '../../../lib/webhook-handler.js';
import { getSetting } from '../../../lib/db.js';

/**
 * GET /api/webhook - Webhook verification (Meta challenge)
 * When you set up the webhook in Meta App Dashboard, 
 * Meta sends a GET request to verify your endpoint.
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifyToken = getSetting('webhook_verify_token') || process.env.WEBHOOK_VERIFY_TOKEN || 'instabot_verify_2026';

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('[Webhook] ✅ Verification successful');
        return new Response(challenge, { status: 200 });
    }

    console.log('[Webhook] ❌ Verification failed');
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST /api/webhook - Receive Instagram webhook events
 * Instagram sends comment events here via POST
 */
export async function POST(request) {
    try {
        const body = await request.json();

        // Instagram sends the object type in body.object
        if (body.object !== 'instagram') {
            return NextResponse.json({ received: true });
        }

        // Process each entry
        const entries = body.entry || [];
        for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
                if (change.field === 'comments') {
                    const commentData = change.value;
                    await handleCommentEvent(commentData);
                }
            }

            // Also handle messaging events (for future use)
            const messaging = entry.messaging || [];
            for (const msg of messaging) {
                console.log('[Webhook] Messaging event:', JSON.stringify(msg));
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[Webhook] Error processing event:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

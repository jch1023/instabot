import { NextResponse } from 'next/server';
import { handleCommentEvent } from '../../../lib/webhook-handler.js';
import { getSetting } from '../../../lib/db.js';
import { sendTelegramNotification, formatWebhookNotification } from '../../../lib/telegram.js';
import fs from 'fs';
import path from 'path';

// Log webhook payloads to file for debugging
function logWebhook(body) {
    try {
        const logFile = path.join(process.cwd(), 'webhook-log.json');
        let logs = [];
        if (fs.existsSync(logFile)) {
            try { logs = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch (e) { logs = []; }
        }
        logs.push({ timestamp: new Date().toISOString(), body });
        // Keep last 50 entries
        if (logs.length > 50) logs = logs.slice(-50);
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
    } catch (e) {
        console.error('[Webhook] Log write error:', e.message);
    }
}

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

        // Log raw webhook body
        console.log('[Webhook] 📩 Received:', JSON.stringify(body).slice(0, 200));
        logWebhook(body);

        // Send Telegram notification
        const tgMessage = formatWebhookNotification(body);
        sendTelegramNotification(tgMessage).catch(() => { });

        // Instagram sends the object type in body.object
        if (body.object !== 'instagram') {
            console.log('[Webhook] Non-instagram object:', body.object);
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

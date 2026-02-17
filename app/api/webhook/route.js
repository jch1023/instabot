
import { NextResponse } from 'next/server';
import { handleCommentEvent } from '@/lib/webhook-handler.js';
import { getSetting, saveWebhookLog } from '@/lib/db.js';
import { sendTelegramNotification, formatWebhookNotification } from '@/lib/telegram.js';

/**
 * GET /api/webhook - Webhook verification (Meta challenge)
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifyToken = (await getSetting('webhook_verify_token')) || process.env.WEBHOOK_VERIFY_TOKEN || 'instabot_verify_2026';

    // 검증 요청도 로그에 기록
    await saveWebhookLog('verify', { mode, token, challenge }, mode === 'subscribe' && token === verifyToken, null);

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('[Webhook] ✅ Verification successful');
        return new Response(challenge, { status: 200 });
    }

    console.log('[Webhook] ❌ Verification failed');
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST /api/webhook - Receive Instagram webhook events
 */
export async function POST(request) {
    try {
        const body = await request.json();
        console.log('[Webhook] 📩 Received:', JSON.stringify(body).slice(0, 200));

        // DB에 원본 로그 저장
        let eventType = body.object || 'unknown';
        const entries = body.entry || [];

        // 이벤트 유형 파악
        for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
                if (change.field) eventType = change.field;
            }
        }

        // Telegram 알림
        const tgMessage = formatWebhookNotification(body);
        sendTelegramNotification(tgMessage).catch(() => { });

        // Instagram이 아니면 무시
        if (body.object !== 'instagram') {
            await saveWebhookLog(eventType, body, false, 'non-instagram object');
            return NextResponse.json({ received: true });
        }

        // 댓글 이벤트 처리
        let results = [];
        for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
                if (change.field === 'comments') {
                    const commentData = change.value;
                    const result = await handleCommentEvent(commentData);
                    results.push(result);
                }
            }

            const messaging = entry.messaging || [];
            for (const msg of messaging) {
                console.log('[Webhook] Messaging event:', JSON.stringify(msg));
                results.push({ type: 'messaging', data: msg });
            }
        }

        // 처리 결과를 DB에 저장
        await saveWebhookLog(eventType, body, true, results.length > 0 ? results : 'no matching handlers');

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[Webhook] Error processing event:', error);
        // 에러도 로그에 기록
        try { await saveWebhookLog('error', { error: error.message }, false, error.message); } catch (e) { }
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

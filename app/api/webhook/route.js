
import { NextResponse } from 'next/server';
import { handleCommentEvent, handleMessagingEvent } from '@/lib/webhook-handler.js';
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

        let eventType = 'unknown';
        const entries = body.entry || [];
        let processingResults = [];

        // 1. 이벤트 타입 정밀 분석 & 처리
        for (const entry of entries) {
            // A. Messaging Events (DM, Echo)
            if (entry.messaging && entry.messaging.length > 0) {
                for (const msg of entry.messaging) {
                    if (msg.message && msg.message.is_echo) {
                        eventType = '✅ DM 발송 (Echo)';
                    } else if (msg.message) {
                        eventType = '📩 DM 수신';
                        const result = await handleMessagingEvent(msg);
                        processingResults.push({ type: 'messaging_follow_sync', result });
                    } else {
                        eventType = 'Messaging (Other)';
                    }
                    // 메시징 이벤트는 별도 처리 로직이 없으면 로그만 남김
                    processingResults.push({ type: 'messaging', data: msg });
                }
            }

            // B. Changes Events (Comments, Mentions)
            if (entry.changes && entry.changes.length > 0) {
                for (const change of entry.changes) {
                    if (change.field === 'comments') {
                        eventType = '💬 댓글 감지';
                        // 실제 댓글 처리 로직 실행
                        const commentData = change.value;
                        const result = await handleCommentEvent(commentData);
                        processingResults.push(result);
                    } else if (change.field === 'mentions') {
                        eventType = '🔔 멘션 감지';
                        processingResults.push({ type: 'mention', data: change.value });
                    } else {
                        eventType = change.field || 'unknown';
                    }
                }
            }
        }

        // 2. 텔레그램 알림 전송
        try {
            const tgMessage = formatWebhookNotification(body);
            sendTelegramNotification(tgMessage).catch(() => { });
        } catch (e) {
            // 텔레그램 전송 실패는 전체 로직에 영향 주지 않음
        }

        // 3. DB에 로그 저장 (분석된 eventType 사용)
        // Instagram 객체가 아니면 'Invalid Object'
        if (body.object !== 'instagram') {
            await saveWebhookLog('invalid_object', body, false, 'Expected object="instagram"');
            return NextResponse.json({ received: true });
        }

        // 최종 로그 저장
        await saveWebhookLog(eventType, body, true, processingResults.length > 0 ? processingResults : 'No actionable handler');

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('[Webhook] Error processing event:', error);
        // 에러 로그
        try { await saveWebhookLog('❌ 처리 오류', { error: error.message }, false, error.message); } catch (e) { }
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

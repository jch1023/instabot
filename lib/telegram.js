// Telegram notification helper
import { getSetting } from './db.js';

/**
 * Send a Telegram notification
 */
export async function sendTelegramNotification(message) {
    const botToken = await getSetting('telegram_bot_token');
    const chatId = await getSetting('telegram_chat_id');

    if (!botToken || !chatId) {
        console.log('[Telegram] No bot token or chat ID configured, skipping notification');
        return false;
    }

    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
            }),
        });

        const data = await res.json();
        if (!data.ok) {
            console.error('[Telegram] Send failed:', data.description);
            return false;
        }

        console.log('[Telegram] ✅ Notification sent');
        return true;
    } catch (err) {
        console.error('[Telegram] Error:', err.message);
        return false;
    }
}

/**
 * Format webhook event for Telegram
 */
export function formatWebhookNotification(webhookBody) {
    const entries = webhookBody.entry || [];
    const messages = [];

    for (const entry of entries) {
        // Comment events
        const changes = entry.changes || [];
        for (const change of changes) {
            if (change.field === 'comments') {
                const v = change.value || {};
                messages.push(
                    `💬 <b>새 댓글</b>\n` +
                    `👤 @${v.from?.username || '?'}\n` +
                    `📝 "${v.text || ''}"\n` +
                    `📸 Media: ${v.media?.id || '?'}\n` +
                    `🆔 Comment: ${v.id || '?'}`
                );
            }
        }

        // Messaging events
        const messaging = entry.messaging || [];
        for (const msg of messaging) {
            if (msg.message) {
                messages.push(
                    `📩 <b>새 메시지</b>\n` +
                    `👤 From: ${msg.sender?.id || '?'}\n` +
                    `📝 "${msg.message?.text || '(미디어)'}"`
                );
            } else if (msg.read) {
                messages.push(`👁 메시지 읽음`);
            }
        }
    }

    if (messages.length === 0) {
        return `📡 <b>Webhook 수신</b>\n${JSON.stringify(webhookBody).slice(0, 200)}`;
    }

    return messages.join('\n\n');
}

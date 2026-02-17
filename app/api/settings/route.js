import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db.js';

/**
 * GET /api/settings - Get all settings
 */
export async function GET() {
    try {
        const settings = {
            webhook_verify_token: await getSetting('webhook_verify_token'),
            meta_app_id: await getSetting('meta_app_id'),
            meta_app_secret: await getSetting('meta_app_secret') ? '••••••••' : '',
            instagram_access_token: await getSetting('instagram_access_token') ? '••••••••' : '',
            ig_user_id: (await getSetting('ig_user_id')) || '',
            ig_username: (await getSetting('ig_username')) || '',
            telegram_bot_token: await getSetting('telegram_bot_token') ? '••••••••' : '',
            telegram_chat_id: (await getSetting('telegram_chat_id')) || '',
        };
        return NextResponse.json(settings);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PUT /api/settings - Update settings
 */
export async function PUT(request) {
    try {
        const body = await request.json();

        const allowedKeys = [
            'webhook_verify_token', 'meta_app_id', 'meta_app_secret',
            'instagram_access_token', 'ig_user_id', 'ig_username',
            'telegram_bot_token', 'telegram_chat_id',
        ];

        for (const [key, value] of Object.entries(body)) {
            if (allowedKeys.includes(key)) {
                // Don't update masked values
                if (value !== '••••••••') {
                    await setSetting(key, value);
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

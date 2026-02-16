import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '../../../lib/db.js';

/**
 * GET /api/settings - Get all settings
 */
export async function GET() {
    try {
        const settings = {
            webhook_verify_token: getSetting('webhook_verify_token'),
            meta_app_id: getSetting('meta_app_id'),
            meta_app_secret: getSetting('meta_app_secret') ? '••••••••' : '',
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

        for (const [key, value] of Object.entries(body)) {
            if (['webhook_verify_token', 'meta_app_id', 'meta_app_secret'].includes(key)) {
                // Don't update masked values
                if (value !== '••••••••') {
                    setSetting(key, value);
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

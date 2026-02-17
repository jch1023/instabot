import { NextResponse } from 'next/server';
import { getAllCampaigns, createCampaign } from '@/lib/db.js';

/**
 * GET /api/campaigns - List all campaigns
 */
export async function GET() {
    try {
        const campaigns = await getAllCampaigns();
        // Parse keywords JSON string back to array
        const parsed = campaigns.map(c => ({
            ...c,
            keywords: JSON.parse(c.keywords || '[]'),
        }));
        return NextResponse.json(parsed);
    } catch (error) {
        console.error('[API] Error fetching campaigns:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/campaigns - Create a new campaign
 */
export async function POST(request) {
    try {
        const body = await request.json();

        if (!body.name) {
            return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
        }

        const campaign = await createCampaign(body);
        return NextResponse.json(campaign, { status: 201 });
    } catch (error) {
        console.error('[API] Error creating campaign:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

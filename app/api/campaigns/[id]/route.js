import { NextResponse } from 'next/server';
import { getCampaignById, updateCampaign, deleteCampaign, toggleCampaign } from '../../../../lib/db.js';

/**
 * GET /api/campaigns/[id] - Get a single campaign
 */
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const campaign = getCampaignById(id);
        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }
        return NextResponse.json({
            ...campaign,
            keywords: JSON.parse(campaign.keywords || '[]'),
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PUT /api/campaigns/[id] - Update a campaign
 */
export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const updated = updateCampaign(id, body);
        return NextResponse.json({
            ...updated,
            keywords: JSON.parse(updated.keywords || '[]'),
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PATCH /api/campaigns/[id] - Toggle campaign active status
 */
export async function PATCH(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        toggleCampaign(id, body.is_active);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/campaigns/[id] - Delete a campaign
 */
export async function DELETE(request, { params }) {
    try {
        const { id } = await params;
        deleteCampaign(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

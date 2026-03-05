import { NextResponse } from 'next/server';
import { verifySignature, fetchLeadData } from '@/lib/meta';
import { db } from '@/db';
import { leads } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { enqueueEvent } from '@/lib/queue';

export async function GET(req: Request) {
    // Meta webhook verification
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }

    return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
    const signature = req.headers.get('x-hub-signature-256');
    if (!signature) return new NextResponse('Missing signature', { status: 400 });

    const rawBody = await req.text();

    if (!verifySignature(rawBody, signature)) {
        return new NextResponse('Invalid signature', { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // We only care about leadgen events
    if (payload.object !== 'page') {
        return new NextResponse('Not a page event', { status: 200 });
    }

    for (const entry of payload.entry) {
        for (const change of entry.changes) {
            if (change.field === 'leadgen') {
                const leadgenId = change.value.leadgen_id;

                try {
                    // Idempotency Check: Does lead exist?
                    const existing = await db.select().from(leads).where(eq(leads.lead_id, leadgenId));
                    if (existing.length > 0) {
                        console.log(`Lead ${leadgenId} already ingested. Skipping duplicate webhook.`);
                        continue;
                    }

                    // Fetch real data from Graph API
                    const leadData = await fetchLeadData(leadgenId);

                    // E.164 normalization logic would go here
                    const rawPhone = leadData.details?.phone_number || null;
                    let normalizedPhone = rawPhone;
                    if (rawPhone && !rawPhone.startsWith('+')) {
                        // Simplified E164 (assuming North America Default)
                        normalizedPhone = `+1${rawPhone.replace(/\D/g, '')}`;
                    }

                    const newLead = {
                        lead_id: leadgenId,
                        source: 'meta',
                        name: leadData.details?.full_name || 'New Lead',
                        email: leadData.details?.email || null,
                        phone: normalizedPhone,
                        status: 'NEW' as const,
                        consent_email: true,
                        consent_whatsapp: true,
                        notes: leadData.details
                    };

                    // Save to DB
                    await db.insert(leads).values(newLead);

                    console.log(`Successfully ingested new lead: ${leadgenId}`);

                    // Enqueue Workflow B
                    await enqueueEvent('lead.created', { lead_id: leadgenId });

                } catch (err: any) {
                    console.error(`Error processing leadgen change: ${err.message}`);
                    // Returning 500 will make Meta retry. If it's a transient Graph API error, it's good.
                    // If it's something permanent, we should catch it so we don't block the queue.
                }
            }
        }
    }

    return new NextResponse('EVENT_RECEIVED', { status: 200 });
}

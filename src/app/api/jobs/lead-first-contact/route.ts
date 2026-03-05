import { NextResponse } from 'next/server';
import { db } from '@/db';
import { leads } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendTemplate } from '@/lib/whatsapp';
import { sendEmail } from '@/lib/email';
import { enqueueEvent } from '@/lib/queue';

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        const leadId = payload.lead_id;

        if (!leadId) return new NextResponse('Missing lead_id', { status: 400 });

        const leadRecords = await db.select().from(leads).where(eq(leads.lead_id, leadId));
        if (leadRecords.length === 0) return new NextResponse('Lead not found', { status: 404 });

        const lead = leadRecords[0];

        // If already contacted, idempotency guard
        if (lead.status !== 'NEW') {
            console.log(`Lead ${leadId} is not NEW (status: ${lead.status}). Skipping first contact.`);
            return new NextResponse('OK', { status: 200 });
        }

        let contacted = false;

        // Send WhatsApp Template if phone exists
        if (lead.phone && lead.consent_whatsapp) {
            try {
                await sendTemplate(lead.phone, 'lead_welcome_booking', [
                    lead.name?.split(' ')[0] || 'there',
                    lead.session_type || 'photography'
                ]);
                contacted = true;
            } catch (err: any) {
                console.error(`Failed WA first contact for ${leadId}:`, err.message);
            }
        }

        // Send Email if email exists
        if (lead.email && lead.consent_email) {
            try {
                const emailBody = `Hi ${lead.name?.split(' ')[0] || 'there'},\n\nThanks for reaching out to Moments to Frames Studio in Barrhaven. Let's get your ${lead.session_type || 'photo'} session scheduled! Do you have a preferred date range in mind, and would you prefer our studio or an outdoor location?\n\nBest,\nMTF Studio Team\n\nMoments to Frames Studio — Barrhaven, Ottawa.\nReply STOP to opt out of messages.`;
                await sendEmail(lead.email, `Next steps for your session in Barrhaven`, emailBody);
                contacted = true;
            } catch (err: any) {
                console.error(`Failed Email first contact for ${leadId}:`, err.message);
            }
        }

        if (contacted) {
            await db.update(leads).set({
                status: 'CONTACTED',
                last_contact_at: new Date(),
            }).where(eq(leads.lead_id, leadId));

            // Schedule follow-up check in 2 hours
            await enqueueEvent('job.followup_check', { lead_id: leadId }, 2 * 60 * 60);
        } else {
            await db.update(leads).set({
                status: 'NEEDS_MANUAL',
            }).where(eq(leads.lead_id, leadId));
        }

        return new NextResponse('OK', { status: 200 });
    } catch (err: any) {
        console.error('Lead First Contact Job Error:', err.message);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

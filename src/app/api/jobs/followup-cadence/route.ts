import { NextResponse } from 'next/server';
import { db } from '@/db';
import { leads, message_log } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { runFollowupAgent } from '@/lib/agents';
import { sendMessage } from '@/lib/whatsapp';
import { enqueueEvent } from '@/lib/queue';

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        const { lead_id } = payload;

        const leadRecords = await db.select().from(leads).where(eq(leads.lead_id, lead_id));
        if (leadRecords.length === 0) return new NextResponse('OK', { status: 200 });
        const lead = leadRecords[0];

        // Stop conditions
        if (['OPT_OUT', 'BOOKED', 'CLOSED', 'ENGAGED'].includes(lead.status)) {
            console.log(`Followup cancelled for ${lead_id}; status is ${lead.status}`);
            return new NextResponse('OK', { status: 200 });
        }

        // Check if they replied recently (safety fallback)
        if (lead.last_reply_at && lead.last_contact_at && lead.last_reply_at > lead.last_contact_at) {
            console.log(`Followup cancelled for ${lead_id}; user replied recently.`);
            return new NextResponse('OK', { status: 200 });
        }

        const nextStage = lead.followup_stage + 1;

        if (nextStage > 3) {
            await db.update(leads).set({ status: 'CLOSED' }).where(eq(leads.lead_id, lead_id));
            console.log(`Lead ${lead_id} closed after max followups.`);
            return new NextResponse('OK', { status: 200 });
        }

        const messageText = await runFollowupAgent(lead, nextStage);

        // Send follow-up (using WA as primary example here)
        if (lead.phone && lead.consent_whatsapp) {
            // Assuming standard WA rules allow this, or it's within a window. Otherwise, we'd fall back to email.
            // For this phase, we'll blast the text via WA directly. 
            try {
                await sendMessage(lead.phone, messageText);

                await db.insert(message_log).values({
                    lead_id,
                    channel: 'whatsapp',
                    direction: 'outbound',
                    content: messageText,
                    intent_tag: `followup_stage_${nextStage}`
                });
            } catch (err: any) {
                console.warn(`Failed WA followup for ${lead_id}:`, err.message);
            }
        }

        await db.update(leads).set({
            followup_stage: nextStage,
            last_contact_at: new Date()
        }).where(eq(leads.lead_id, lead_id));

        // Schedule next stage
        const delaySeconds = nextStage === 1 ? (24 * 60 * 60) : (72 * 60 * 60);
        await enqueueEvent('job.followup_check', { lead_id }, delaySeconds);

        return new NextResponse('OK', { status: 200 });
    } catch (err: any) {
        console.error('Followup Cadence Job Error:', err.message);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

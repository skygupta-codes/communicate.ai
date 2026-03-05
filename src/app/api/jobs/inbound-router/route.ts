import { NextResponse } from 'next/server';
import { db } from '@/db';
import { leads, message_log, jobs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { runComplianceGuard, runConversationAgent } from '@/lib/agents';
import { sendMessage } from '@/lib/whatsapp';
import { sendEmail } from '@/lib/email';

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        const { lead_id, channel, text, msg_id } = payload;

        const leadRecords = await db.select().from(leads).where(eq(leads.lead_id, lead_id));
        if (leadRecords.length === 0) return new NextResponse('OK', { status: 200 });
        const lead = leadRecords[0];

        // Compliance / Opt-out Guard
        const complianceToken = await runComplianceGuard(lead, text, channel) as any;

        if (complianceToken.detected_opt_out) {
            await db.update(leads).set({ status: 'OPT_OUT' }).where(eq(leads.lead_id, lead_id));
            console.log(`Lead ${lead_id} opted out.`);
            return new NextResponse('OK', { status: 200 });
        }

        if (!complianceToken.allow) {
            console.log(`Compliance guard rejected reply to ${lead_id}: ${complianceToken.reason}`);
            return new NextResponse('OK', { status: 200 });
        }

        // Set to ENGAGED
        await db.update(leads).set({
            status: 'ENGAGED',
            last_reply_at: new Date()
        }).where(eq(leads.lead_id, lead_id));

        // Fetch history
        const history = await db.select().from(message_log)
            .where(eq(message_log.lead_id, lead_id))
            .orderBy(desc(message_log.timestamp))
            .limit(10); // recent context

        // Run Agent
        const conversationAction = await runConversationAgent(lead, history.reverse(), text);

        // Send Reply
        if (channel === 'whatsapp' && lead.phone) {
            await sendMessage(lead.phone, conversationAction.reply_text);
        } else if (channel === 'email' && lead.email) {
            await sendEmail(lead.email, `Re: Booking your session`, conversationAction.reply_text);
        }

        // Log Outbound
        await db.insert(message_log).values({
            lead_id,
            channel,
            direction: 'outbound',
            content: conversationAction.reply_text,
            intent_tag: conversationAction.intent
        });

        // Note: If intent is booking_intent, we would enqueue a BookingFlow job here (Phase 1.5)

        return new NextResponse('OK', { status: 200 });
    } catch (err: any) {
        console.error('Inbound Router Job Error:', err.message);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

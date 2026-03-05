import { NextResponse } from 'next/server';
import { enqueueEvent } from '@/lib/queue';
import { db } from '@/db';
import { leads, message_log } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: Request) {
    // WhatsApp Verification
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
    // Skipping signature validation for brevity in boilerplate, but in prod verify X-Hub-Signature-256
    try {
        const payload = await req.json();

        if (payload.object !== 'whatsapp_business_account') {
            return new NextResponse('OK', { status: 200 });
        }

        for (const entry of payload.entry) {
            for (const change of entry.changes) {
                if (change.value && change.value.messages) {
                    for (const message of change.value.messages) {

                        // Extract core details
                        const fromNumber = `+${message.from}`; // WhatsApp sends without '+', e164 matching needs '+'
                        const textContent = message.text?.body || '';
                        const msgId = message.id;

                        console.log(`Received WA Inbound from ${fromNumber}: ${textContent.slice(0, 30)}...`);

                        // Find matching lead
                        const matches = await db.select().from(leads).where(eq(leads.phone, fromNumber));

                        let targetLeadId: string | null = null;

                        if (matches.length > 0) {
                            targetLeadId = matches[0].lead_id;

                            // Log inbound globally
                            await db.insert(message_log).values({
                                lead_id: targetLeadId,
                                channel: 'whatsapp',
                                direction: 'inbound',
                                content: textContent,
                                provider_ref: msgId
                            });

                            // Send to Router Workflow C
                            await enqueueEvent('inbound.message', {
                                lead_id: targetLeadId,
                                channel: 'whatsapp',
                                msg_id: msgId,
                                text: textContent
                            });

                        } else {
                            console.warn(`Received WhatsApp message from unknown number: ${fromNumber}`);
                        }
                    }
                }
            }
        }

        return new NextResponse('OK', { status: 200 });
    } catch (err: any) {
        console.error('Error handling WA webhook:', err.message);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

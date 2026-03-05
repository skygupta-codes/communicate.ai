import { NextResponse } from 'next/server';
import { enqueueEvent } from '@/lib/queue';
import { db } from '@/db';
import { leads, message_log } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
    try {
        // SendGrid Inbound Parse payload is multipart/form-data
        const formData = await req.formData();

        // SendGrid parses the email cleanly into fields
        const fromField = formData.get('from') as string || '';
        const subject = formData.get('subject') as string || '';
        const textContent = formData.get('text') as string || '';

        // Extract actual email from "Name <email@exampl.com>" format
        const emailMatch = fromField.match(/<([^>]+)>/) || [null, fromField];
        const rawEmail = emailMatch[1]?.trim().toLowerCase();

        if (!rawEmail) {
            return new NextResponse('OK', { status: 200 });
        }

        // Find matching lead by email
        const matches = await db.select().from(leads).where(eq(leads.email, rawEmail));

        let targetLeadId: string | null = null;

        if (matches.length > 0) {
            targetLeadId = matches[0].lead_id;

            // Log inbound globally
            await db.insert(message_log).values({
                lead_id: targetLeadId,
                channel: 'email',
                direction: 'inbound',
                content: `${subject}\n${textContent}`,
            });

            // Send to Router Workflow C
            await enqueueEvent('inbound.message', {
                lead_id: targetLeadId,
                channel: 'email',
                text: textContent,
                subject: subject
            });

        } else {
            console.warn(`Received Inbound Email from unknown address: ${rawEmail}`);
        }

        return new NextResponse('OK', { status: 200 });
    } catch (err: any) {
        console.error('Error handling Email Webhook:', err.message);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

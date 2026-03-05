import { Client } from '@upstash/qstash';

const qstashClient = new Client({
    token: process.env.QSTASH_TOKEN || '',
});

/**
 * Enqueue an event for background processing.
 */
export async function enqueueEvent(eventName: string, payload: any, delaySeconds: number = 0) {
    if (!process.env.QSTASH_TOKEN) {
        console.warn(`QSTASH_TOKEN not set. Simulating enqueue for [${eventName}]...`);
        // In dev, you might want to dynamically route to localhost or a tunnel.
        return 'mock-msg-id';
    }

    // Determine standard app URL, fallback to Vercel URL
    const baseUrl = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');
    let url = '';

    if (eventName === 'lead.created') {
        url = `${baseUrl}/api/jobs/lead-first-contact`;
    } else if (eventName === 'job.followup_check') {
        url = `${baseUrl}/api/jobs/followup-cadence`;
    } else if (eventName === 'inbound.message') {
        url = `${baseUrl}/api/jobs/inbound-router`;
    } else {
        throw new Error(`Unknown event name: ${eventName}`);
    }

    try {
        const res = await qstashClient.publishJSON({
            url,
            body: payload,
            delay: delaySeconds,
        });
        return res.messageId;
    } catch (err: any) {
        console.error(`Failed to enqueue event ${eventName}:`, err.message);
        throw new Error('Queue publish failed');
    }
}

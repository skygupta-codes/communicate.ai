import crypto from 'crypto';
import axios from 'axios';

const SYSTEM_ACCESS_TOKEN = process.env.SYSTEM_USER_ACCESS_TOKEN || '';

/**
 * Verify Meta Webhook Request Signature
 */
export function verifySignature(payload: string, signature: string): boolean {
    const APP_SECRET = process.env.APP_SECRET || '';
    if (!APP_SECRET || !signature) return false;

    const hmac = crypto.createHmac('sha256', APP_SECRET);
    const digest = Buffer.from('sha256=' + hmac.update(payload).digest('hex'), 'utf8');
    const checksum = Buffer.from(signature, 'utf8');

    if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
        return false;
    }
    return true;
}

/**
 * Fetch lead details from Graph API using leadgen_id
 */
export async function fetchLeadData(leadgenId: string) {
    try {
        const response = await axios.get(`https://graph.facebook.com/v19.0/${leadgenId}`, {
            params: {
                access_token: SYSTEM_ACCESS_TOKEN,
            }
        });

        // Parse the field_data from Meta into a key-value object
        const fieldData = response.data.field_data || [];
        const leadDetails: Record<string, string> = {};

        for (const field of fieldData) {
            if (field.values && field.values.length > 0) {
                leadDetails[field.name] = field.values[0];
            }
        }

        return {
            raw: response.data,
            details: leadDetails
        };
    } catch (err: any) {
        console.error(`Error fetching lead [${leadgenId}]:`, err.response?.data || err.message);
        throw new Error('Failed to fetch lead data from Meta');
    }
}

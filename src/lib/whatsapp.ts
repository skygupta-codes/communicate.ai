import axios from 'axios';

const WA_TOKEN = process.env.META_WHATSAPP_TOKEN || '';
const PHONE_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID || '';

/**
 * Send an approved WhatsApp template.
 */
export async function sendTemplate(toPhoneE164: string, templateName: string, params: string[] = []) {
    const url = `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`;

    const parameters = params.map(text => ({
        type: 'text',
        text
    }));

    const payload = {
        messaging_product: 'whatsapp',
        to: toPhoneE164.replace(/\+/g, ''),
        type: 'template',
        template: {
            name: templateName,
            language: {
                code: 'en'
            },
            components: parameters.length > 0 ? [
                {
                    type: 'body',
                    parameters
                }
            ] : []
        }
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${WA_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (err: any) {
        console.error('Error sending WA Template:', err.response?.data || err.message);
        throw new Error('Failed to send WhatsApp Template');
    }
}

/**
 * Send a freeform text message (Must be within 24h of inbound).
 */
export async function sendMessage(toPhoneE164: string, text: string) {
    const url = `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhoneE164.replace(/\+/g, ''),
        type: 'text',
        text: { body: text }
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${WA_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (err: any) {
        console.error('Error sending WA Message:', err.response?.data || err.message);
        throw new Error('Failed to send WhatsApp Message');
    }
}

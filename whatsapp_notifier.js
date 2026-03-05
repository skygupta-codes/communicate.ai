const axios = require('axios');
const config = require('./config');

class WhatsappNotifier {
    async send(message) {
        let attempts = 0;
        const maxRetries = 3;

        // Use v17.0 default, easily updatable if needed
        const url = `https://graph.facebook.com/v17.0/${config.metaWhatsappPhoneNumberId}/messages`;

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: config.whatsappToE164.replace(/\+/g, ''), // Meta requires E164 without the '+'
            type: 'text',
            text: { body: message }
        };

        const headers = {
            'Authorization': `Bearer ${config.metaWhatsappToken}`,
            'Content-Type': 'application/json'
        };

        while (attempts < maxRetries) {
            try {
                await axios.post(url, payload, { headers, timeout: 5000 });
                return true;
            } catch (err) {
                attempts++;
                const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
                console.warn(`WhatsApp send failed (attempt ${attempts}/${maxRetries}): ${errMsg}`);

                if (attempts >= maxRetries) {
                    throw new Error(`WhatsApp failed after ${maxRetries} attempts: ${errMsg}`);
                }

                // Exponential backoff: 1s, 2s, 4s
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts - 1) * 1000));
            }
        }
    }
}

module.exports = new WhatsappNotifier();

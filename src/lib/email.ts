// simple wrapper using native fetch to avoid heavy sendgrid packages for basic usages
const SG_API_KEY = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || '';

export async function sendEmail(to: string, subject: string, bodyText: string, bodyHtml?: string, replyToMessageId?: string) {
    if (!SG_API_KEY) {
        console.warn('SENDGRID_API_KEY not set. Mocking email send:', { to, subject });
        return;
    }

    const payload: any = {
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL },
        subject: subject,
        content: [
            { type: 'text/plain', value: bodyText }
        ]
    };

    if (bodyHtml) {
        payload.content.push({ type: 'text/html', value: bodyHtml });
    }

    if (replyToMessageId) {
        payload.headers = {
            'In-Reply-To': replyToMessageId,
            'References': replyToMessageId
        };
    }

    try {
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${SG_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`SendGrid API Error: ${text}`);
        }

        return true;
    } catch (err: any) {
        console.error('Failed to send email:', err.message);
        throw err;
    }
}

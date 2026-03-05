import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

function getAuth() {
    const accountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!accountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');

    const credentials = JSON.parse(accountJson);

    return new google.auth.GoogleAuth({
        credentials,
        scopes: SCOPES,
    });
}

export async function getAvailability(timeMin: string, timeMax: string) {
    try {
        const auth = getAuth();
        const calendar = google.calendar({ version: 'v3', auth });

        // Hardcoded to primary or a specific studio calendar ID
        const calendarId = process.env.STUDIO_CALENDAR_ID || 'primary';

        // We use FreeBusy API
        const response = await calendar.freebusy.query({
            requestBody: {
                timeMin,
                timeMax,
                items: [{ id: calendarId }]
            }
        });

        return response.data.calendars?.[calendarId]?.busy || [];
    } catch (err: any) {
        console.error('Calendar Availability Error:', err.message);
        throw new Error('Failed to fetch calendar availability');
    }
}

export async function createEvent(title: string, start: string, end: string, description: string) {
    try {
        const auth = getAuth();
        const calendar = google.calendar({ version: 'v3', auth });
        const calendarId = process.env.STUDIO_CALENDAR_ID || 'primary';

        const event = {
            summary: title,
            location: '3 Stoneleigh Street, Barrhaven, Ottawa',
            description,
            start: {
                dateTime: start,
                timeZone: 'America/Toronto',
            },
            end: {
                dateTime: end,
                timeZone: 'America/Toronto',
            },
        };

        const response = await calendar.events.insert({
            calendarId,
            requestBody: event,
        });

        return response.data;
    } catch (err: any) {
        console.error('Calendar Create Event Error:', err.message);
        throw new Error('Failed to create calendar event');
    }
}

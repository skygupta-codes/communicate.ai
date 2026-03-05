const { google } = require('googleapis');
const config = require('./config');

class SheetsClient {
    constructor() {
        this.authClient = null;
        this.sheetsAPI = null;
    }

    async initialize() {
        if (this.sheetsAPI) return;

        try {
            const decodedJson = Buffer.from(config.googleServiceAccountJsonBase64, 'base64').toString('utf8');
            const credentials = JSON.parse(decodedJson);

            this.authClient = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
            });

            this.sheetsAPI = google.sheets({ version: 'v4', auth: this.authClient });
        } catch (err) {
            console.error(`Failed to initialize Google Sheets client: ${err.message}`);
            throw err;
        }
    }

    async getRows() {
        await this.initialize();

        try {
            const response = await this.sheetsAPI.spreadsheets.values.get({
                spreadsheetId: config.googleSheetId,
                range: `${config.googleSheetTab}!${config.googleSheetRange}`,
            });

            // return 2D array of rows, or empty array if no data
            return response.data.values || [];
        } catch (err) {
            console.error(`Google Sheets API Error (getRows): ${err.message}`);
            throw err;
        }
    }
}

module.exports = new SheetsClient();

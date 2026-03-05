require('dotenv').config();

const config = {
  // Google Sheets
  googleSheetId: process.env.GOOGLE_SHEET_ID,
  googleSheetTab: process.env.GOOGLE_SHEET_TAB,
  googleSheetRange: process.env.GOOGLE_SHEET_RANGE || 'A:Z',
  googleServiceAccountJsonBase64: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,

  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,

  // Meta WhatsApp
  metaWhatsappToken: process.env.META_WHATSAPP_TOKEN,
  metaWhatsappPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID,
  whatsappToE164: process.env.WHATSAPP_TO_E164,

  // App Runtime
  pollIntervalSeconds: parseInt(process.env.POLL_INTERVAL_SECONDS || '30', 10),
  statePath: process.env.STATE_PATH || './state.json',
  logLevel: (process.env.LOG_LEVEL || 'INFO').toUpperCase()
};

// Validate required fields
const requiredFields = [
  'googleSheetId', 'googleSheetTab', 'googleServiceAccountJsonBase64',
  'telegramBotToken', 'telegramChatId',
  'metaWhatsappToken', 'metaWhatsappPhoneNumberId', 'whatsappToE164'
];

const missing = requiredFields.filter(field => !config[field]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = config;

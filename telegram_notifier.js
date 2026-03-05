const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

class TelegramNotifier {
    constructor() {
        this.bot = new TelegramBot(config.telegramBotToken, { polling: false });
    }

    async send(message) {
        let attempts = 0;
        const maxRetries = 3;

        while (attempts < maxRetries) {
            try {
                await this.bot.sendMessage(config.telegramChatId, message);
                return true;
            } catch (err) {
                attempts++;
                console.warn(`Telegram send failed (attempt ${attempts}/${maxRetries}): ${err.message}`);

                if (attempts >= maxRetries) {
                    throw new Error(`Telegram failed after ${maxRetries} attempts: ${err.message}`);
                }

                // Exponential backoff: 1s, 2s, 4s
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts - 1) * 1000));
            }
        }
    }
}

module.exports = new TelegramNotifier();

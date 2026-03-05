const config = require('./config');
const rowDetector = require('./row_detector');
const telegramNotifier = require('./telegram_notifier');
const whatsappNotifier = require('./whatsapp_notifier');
const stateStore = require('./state_store');
const { formatMessage } = require('./utils');

async function processCycle() {
    try {
        const newRows = await rowDetector.getNewRows();

        if (newRows.length === 0) {
            if (config.logLevel === 'DEBUG') {
                console.log(`[${new Date().toISOString()}] No new rows detected.`);
            }
            return;
        }

        console.log(`[${new Date().toISOString()}] Detected ${newRows.length} new row(s). Processing...`);

        for (const row of newRows) {
            const message = formatMessage(row.rowIndex, row.data, config.googleSheetTab);
            const logId = `${config.googleSheetId}-${config.googleSheetTab}-${row.rowIndex}-${new Date().toISOString()}`;

            try {
                console.log(`[${logId}] Attempting Telegram...`);
                await telegramNotifier.send(message);
                console.log(`[${logId}] [SUCCESS] Telegram`);

                console.log(`[${logId}] Attempting WhatsApp...`);
                await whatsappNotifier.send(message);
                console.log(`[${logId}] [SUCCESS] WhatsApp`);

                // If both succeed, advance state index
                stateStore.updateLastProcessedRowIndex(row.rowIndex);
                console.log(`[${logId}] State updated safely to row ${row.rowIndex}`);

            } catch (err) {
                console.error(`[${logId}] [FAILED] Delivery error for row ${row.rowIndex}: ${err.message}`);
                console.error(`[${logId}] Halting current cycle to preserve idempotency. Will retry later.`);
                // Stop processing further rows this cycle
                break;
            }
        }
    } catch (err) {
        console.error(`[System Error] ${err.message}`);
    }
}

async function main() {
    console.log(`Starting Antigravity Google Sheets Notifier...`);
    console.log(`Polling interval: ${config.pollIntervalSeconds}s`);
    console.log(`Listening for tab: ${config.googleSheetTab}`);

    // Make sure state is loaded
    stateStore.load();
    console.log(`Loaded state: starting after row ${stateStore.getLastProcessedRowIndex()}`);

    while (true) {
        await processCycle();
        await new Promise(resolve => setTimeout(resolve, config.pollIntervalSeconds * 1000));
    }
}

// Start app
main();

const sheetsClient = require('./sheets_client');
const stateStore = require('./state_store');

class RowDetector {
    async getNewRows() {
        const allRows = await sheetsClient.getRows();

        // allRows is a 0-indexed array where allRows[0] is typically row 1 (header).
        // The Google Sheet row index is 1-based. So row_index = array_index + 1.

        const lastProcessedIndex = stateStore.getLastProcessedRowIndex();
        const newRows = [];

        // We only process rows where row_index > lastProcessedIndex.
        // In terms of 0-based array index, that means array_index must be >= lastProcessedIndex
        for (let i = lastProcessedIndex; i < allRows.length; i++) {
            const row = allRows[i];
            // Check if row is physically non-empty (at least one cell has value)
            const isNotEmpty = row.some(cell => cell !== undefined && cell !== null && cell.trim() !== '');

            if (isNotEmpty) {
                newRows.push({
                    rowIndex: i + 1, // 1-based index
                    data: row
                });
            } else {
                // Option to advance idempotency over empty rows to skip them entirely if they are in the middle of data
                // For now, we only advance idempotency when we successfully process a non-empty row.
                // Wait, if we don't advance the state index for an empty row, the next run will read the sheet again, 
                // see it's empty, and do nothing, but it won't process rows after it unless we allow processing beyond the first empty row.
                // The current loop processes all new rows after lastProcessedIndex, so we are fine. 
                // We just don't notify empty rows.
            }
        }

        return newRows;
    }
}

module.exports = new RowDetector();

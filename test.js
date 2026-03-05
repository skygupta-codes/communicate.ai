const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { formatMessage } = require('./utils');

// Simple test runner
async function runTests() {
    console.log('--- Running Tests ---');

    // Test 1: Message Formatting
    try {
        const data = ['Alice', 'alice@test.com'];
        const tabName = 'Leads';
        const rowIndex = 3;
        const msg = formatMessage(rowIndex, data, tabName, '2023-10-01T12:00:00.000Z');

        assert.strictEqual(
            msg,
            `[New Row] Sheet=Leads Row=3 Time=2023-10-01T12:00:00.000Z\nData=Alice | alice@test.com |   |   |  `
        );
        console.log('✅ Message format correctly applies padding and structure.');
    } catch (err) {
        console.error('❌ Message Formatting Test Failed:', err.message);
    }

    // Test 2: State Load/Save logic
    try {
        const tempStateFile = path.resolve(__dirname, 'test_state.json');
        if (fs.existsSync(tempStateFile)) fs.unlinkSync(tempStateFile);

        // Swap config state path for test
        const config = require('./config');
        const originalPath = config.statePath;
        config.statePath = tempStateFile;

        // We require a fresh instance to use the overridden config
        delete require.cache[require.resolve('./state_store')];
        const stateStore = require('./state_store');

        const initialIndex = stateStore.getLastProcessedRowIndex();
        assert.strictEqual(initialIndex, 1, 'Initial index should be 1');

        stateStore.updateLastProcessedRowIndex(5);
        const updatedIndex = stateStore.getLastProcessedRowIndex();
        assert.strictEqual(updatedIndex, 5, 'Updated index should be 5');

        // Reload from file
        delete require.cache[require.resolve('./state_store')];
        const stateStoreLoaded = require('./state_store');
        assert.strictEqual(stateStoreLoaded.getLastProcessedRowIndex(), 5, 'Loaded index should be 5');

        fs.unlinkSync(tempStateFile);
        config.statePath = originalPath;
        console.log('✅ State load/save logic works correctly.');
    } catch (err) {
        console.error('❌ State Load/Save Test Failed:', err.message);
    }

    // Test 3: Row Detector logic
    try {
        // Mock the dependency
        const sheetsClient = require('./sheets_client');
        sheetsClient.getRows = async () => [
            ['Header1', 'Header2'],          // index 0 (row 1)
            ['Data1', 'Data2'],              // index 1 (row 2)
            [],                              // index 2 (row 3) - Empty array
            ['Data3', ''],                   // index 3 (row 4)
            [null, undefined, ' '],          // index 4 (row 5) - Essentially empty
            ['Data4', 'Data5']               // index 5 (row 6)
        ];

        const stateStore = require('./state_store');
        stateStore.getLastProcessedRowIndex = () => 1; // Process from row 2 onwards

        const rowDetector = require('./row_detector');
        const newRows = await rowDetector.getNewRows();

        // Rows 2, 4, 6 should be the genuinely non-empty new rows
        assert.strictEqual(newRows.length, 3, 'Should detect precisely 3 non-empty new rows');
        assert.strictEqual(newRows[0].rowIndex, 2);
        assert.strictEqual(newRows[1].rowIndex, 4);
        assert.strictEqual(newRows[2].rowIndex, 6);

        console.log('✅ Row Detector accurately identifies new, non-empty rows.');

    } catch (err) {
        console.error('❌ Row Detector Test Failed:', err.message);
    }

    console.log('--- Testing Complete ---');
}

runTests();

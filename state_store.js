const fs = require('fs');
const path = require('path');
const config = require('./config');

class StateStore {
    constructor(statePath = config.statePath) {
        this.statePath = path.resolve(statePath);
        this.stateCache = null;
    }

    // Load state from disk, or initialize if it doesn't exist
    load() {
        if (fs.existsSync(this.statePath)) {
            try {
                const data = fs.readFileSync(this.statePath, 'utf8');
                this.stateCache = JSON.parse(data);
            } catch (err) {
                console.error(`Failed to parse state file at ${this.statePath}: ${err.message}`);
                // If file exists but is corrupted, we don't automatically overwrite it to prevent data loss.
                process.exit(1);
            }
        } else {
            // Default initialization
            // Default assumption from plan.md: Row 1 is header, start at row 2, so last_processed_row_index = 1
            this.stateCache = {
                last_processed_row_index: 1,
                last_run_time: new Date().toISOString()
            };
            this.save(); // Create the file
        }
        return this.stateCache;
    }

    // Save state to disk
    save() {
        if (!this.stateCache) return;
        try {
            this.stateCache.last_run_time = new Date().toISOString();
            fs.writeFileSync(this.statePath, JSON.stringify(this.stateCache, null, 2), 'utf8');
        } catch (err) {
            console.error(`Failed to write state file to ${this.statePath}: ${err.message}`);
            // This is a critical error since idempotency relies on it.
            throw err;
        }
    }

    // Get the last processed row index
    getLastProcessedRowIndex() {
        if (!this.stateCache) this.load();
        return this.stateCache.last_processed_row_index;
    }

    // Update the last processed row index and save
    updateLastProcessedRowIndex(index) {
        if (!this.stateCache) this.load();
        if (index > this.stateCache.last_processed_row_index) {
            this.stateCache.last_processed_row_index = index;
            this.save();
        }
    }
}

// Export a singleton instance
module.exports = new StateStore();

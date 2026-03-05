function formatMessage(rowIndex, data, tabName, overrideTimestamp) {
    const timestamp = overrideTimestamp || new Date().toISOString();

    // Get first 5 columns, pad with empty strings if less
    const cols = [];
    for (let i = 0; i < 5; i++) {
        cols.push(data[i] || ' ');
    }

    return `[New Row] Sheet=${tabName} Row=${rowIndex} Time=${timestamp}\nData=${cols.join(' | ')}`;
}

module.exports = { formatMessage };

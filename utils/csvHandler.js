const csv = require('csv-parser');
const { Readable } = require('stream');

/**
 * Parses the Zerodha holdings CSV from a buffer.
 * @param {Buffer} buffer - The uploaded file buffer.
 * @returns {Promise<Array>} - Array of parsed objects.
 */
const parseCSV = (buffer) => {
    return new Promise((resolve, reject) => {
        const results = [];
        const stream = Readable.from(buffer);

        stream
            .pipe(csv())
            .on('data', (data) => {
                // Ensure we handle possible variations in Zerodha header names
                // e.g., 'Instrument', 'Qty.', 'Avg. cost'
                const instrument = data['Instrument'] || data['instrument'];
                const qtyStr = data['Qty.'] || data['qty'] || data['quantity'];
                const avgCostStr = data['Avg. cost'] || data['avg. cost'] || data['avgCost'];

                if (instrument && qtyStr && avgCostStr) {
                    const quantity = parseFloat(qtyStr);
                    const avgCost = parseFloat(avgCostStr);
                    
                    if (!isNaN(quantity) && !isNaN(avgCost)) {
                        results.push({
                            instrument: instrument.trim(),
                            quantity,
                            avgCost
                        });
                    }
                }
            })
            .on('end', () => {
                resolve(results);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
};

module.exports = { parseCSV };

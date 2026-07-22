const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

/**
 * Maps standard instrument names to Yahoo Finance format (appending .NS for NSE)
 * @param {string} instrument 
 * @returns {string}
 */
const getYahooSymbol = (instrument) => {
    // Basic mapping, assuming all are NSE stocks for this Zerodha implementation
    // Could add more complex mapping logic here if needed
    return `${instrument}.NS`;
};

/**
 * Fetches market data for a list of instruments and calculates portfolio metrics.
 * @param {Array} holdings - Array of parsed holdings { instrument, quantity, avgCost }
 * @returns {Promise<Object>} - Object containing holdings array and summary metrics.
 */
const fetchMarketData = async (holdings) => {
    const symbols = holdings.map(h => getYahooSymbol(h.instrument));
    
    // Batch fetch from Yahoo Finance
    let quotes = [];
    try {
        // yahooFinance.quote takes a string or array of strings
        quotes = await yahooFinance.quote(symbols);
        // If single symbol, quote() returns an object. Convert to array.
        if (!Array.isArray(quotes)) {
            quotes = [quotes];
        }
    } catch (error) {
        console.error('Yahoo Finance API Error:', error);
        throw new Error('Failed to fetch real-time market data.');
    }

    // Create a map for quick lookup
    const quoteMap = {};
    quotes.forEach(q => {
        quoteMap[q.symbol] = q.regularMarketPrice;
    });

    let totalInvested = 0;
    let totalCurrentValue = 0;

    const enrichedHoldings = holdings.map(h => {
        const symbol = getYahooSymbol(h.instrument);
        const currentPrice = quoteMap[symbol] || 0; // Fallback to 0 if not found
        
        const invested = h.quantity * h.avgCost;
        const currentValue = h.quantity * currentPrice;
        const pnl = currentValue - invested;
        
        totalInvested += invested;
        totalCurrentValue += currentValue;

        return {
            instrument: h.instrument,
            quantity: h.quantity,
            avgCost: h.avgCost,
            currentPrice,
            invested,
            currentValue,
            pnl
        };
    });

    const totalPnl = totalCurrentValue - totalInvested;

    return {
        holdings: enrichedHoldings,
        summary: {
            totalInvested,
            totalCurrentValue,
            totalPnl
        }
    };
};

module.exports = { fetchMarketData };

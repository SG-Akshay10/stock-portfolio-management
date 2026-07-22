const express = require('express');
const multer = require('multer');
const path = require('path');
const { parseCSV } = require('./utils/csvHandler');
const { fetchMarketData } = require('./services/marketData');

const app = express();
const PORT = process.env.PORT || 3000;

// Set up EJS for templating
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Set up Multer for in-memory file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve static assets if needed, though we use CDN for Tailwind
app.use(express.static(path.join(__dirname, 'public')));

// Render upload page
app.get('/', (req, res) => {
    res.render('upload', { error: null });
});

// Handle file upload and process data
app.post('/upload', upload.single('holdings'), async (req, res) => {
    try {
        if (!req.file) {
            return res.render('upload', { error: 'Please upload a CSV file.' });
        }

        // 1. Parse CSV
        const parsedData = await parseCSV(req.file.buffer);

        if (parsedData.length === 0) {
            return res.render('upload', { error: 'The uploaded CSV is empty or invalid.' });
        }

        // 2. Fetch Market Data and calculate P&L
        const portfolioData = await fetchMarketData(parsedData);

        // 3. Render Dashboard
        res.render('dashboard', { portfolio: portfolioData });
    } catch (error) {
        console.error('Error processing upload:', error);
        res.render('upload', { error: error.message || 'An error occurred while processing your file.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

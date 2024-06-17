const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { askChatGPT } = require('./puppeteer');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

app.post('/ask-chatgpt', async (req, res) => {
    const prompt = req.body.prompt;
    if (!prompt) {
        console.log('Request missing prompt');
        return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log('Received prompt:', prompt);

    try {
        const response = await askChatGPT(prompt);
        console.log('Received response from ChatGPT:', response);
        res.json({ response });
    } catch (error) {
        console.error('Error asking ChatGPT:', error);
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(port, () => {
    console.log(`Your app is listening on port ${port}`);
});

const express = require('express');
const bodyParser = require('body-parser');
const askChatGPT = require('./puppeteer');

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());

app.post('/ask-chatgpt', async (req, res) => {
    const prompt = req.body.prompt;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const response = await askChatGPT(prompt);
        res.json({ response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Your app is listening on port ${port}`);
});

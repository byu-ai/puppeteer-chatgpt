const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const askChatGPT = require('./puppeteer');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/ask-chatgpt', async (req, res) => {
    const { prompt } = req.body;
    console.log('Received prompt:', prompt);

    try {
        const response = await askChatGPT(prompt);
        console.log('Sending response:', response);
        res.json({ response });
    } catch (error) {
        console.error('Error interacting with ChatGPT:', error);
        res.status(500).json({ error: 'Failed to interact with ChatGPT' });
    }
});

const PORT = process.env.PORT || 3000;
const listener = app.listen(PORT, () => {
    console.log(`Your app is listening on port ${listener.address().port}`);
});

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

async function askChatGPT(prompt) {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // <- this one doesn't work on Windows
            '--disable-gpu'
        ]
    });

    const page = await browser.newPage();

    // Load cookies from the JSON file if it exists
    const cookiesPath = path.resolve(__dirname, 'cookies.json');
    if (fs.existsSync(cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        await page.setCookie(...cookies);
    }

    try {
        // Go to the ChatGPT chat page directly
        await page.goto('https://chat.openai.com/chat', { waitUntil: 'networkidle2' });

        // Log the page content to see what is being loaded
        const content = await page.content();
        console.log(content);

        // Check if the prompt input field is present in the page content
        const promptInputExists = await page.evaluate(() => {
            return !!document.querySelector('textarea[placeholder="Message ChatGPT"]');
        });

        if (!promptInputExists) {
            throw new Error('Prompt textarea is not present on the page');
        }

        // Wait for the initial elements to ensure the page is loaded
        await page.waitForSelector('textarea[placeholder="Message ChatGPT"]', { timeout: 60000 });

        // Type the prompt into the textarea
        await page.type('textarea[placeholder="Message ChatGPT"]', prompt);

        // Click the send button or press Enter
        await page.click('button[data-testid="send-button"]');

        // Wait for the response
        await page.waitForSelector('div[data-message-author-role="assistant"] .markdown.prose', { timeout: 60000 });

        // Extract the response text
        const response = await page.evaluate(() => {
            const responseElement = document.querySelector('div[data-message-author-role="assistant"] .markdown.prose');
            return responseElement ? responseElement.innerText : 'No response found';
        });

        await browser.close();
        return response;
    } catch (error) {
        console.error('Error in Puppeteer script:', error);
        await page.screenshot({ path: 'error_screenshot.png' }); // Capture screenshot on error (optional)
        await browser.close();
        throw error;
    }
}

module.exports = { askChatGPT };

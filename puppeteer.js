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

    // Load cookies from the JSON file
    const cookiesPath = path.resolve(__dirname, 'cookies.json');
    if (fs.existsSync(cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        await page.setCookie(...cookies);
    }

    try {
        // Go to the ChatGPT chat page directly with an increased timeout
        await page.goto('https://chat.openai.com/chat', { waitUntil: 'networkidle2', timeout: 180000 });

        // Check if the prompt input field is present in the page content
        const promptInputExists = await page.evaluate(() => {
            return !!document.querySelector('textarea[placeholder="Message ChatGPT"]');
        });

        if (!promptInputExists) {
            console.log('Prompt textarea is not present on the page');
            throw new Error('Prompt textarea is not present on the page');
        }

        // Wait for the initial elements to ensure the page is loaded
        await page.waitForSelector('textarea[placeholder="Message ChatGPT"]', { timeout: 120000 });

        // Type the prompt into the textarea
        await page.type('textarea[placeholder="Message ChatGPT"]', prompt);

        // Wait for the send button to become enabled
        await page.waitForFunction(() => {
            const sendButton = document.querySelector('button[data-testid="fruitjuice-send-button"]');
            return sendButton && !sendButton.disabled;
        }, { timeout: 120000 });

        // Click the send button
        await page.click('button[data-testid="fruitjuice-send-button"]');

        // Wait for the response and check for completeness
        const responseSelector = 'div[data-message-author-role="assistant"] .markdown.prose';
        await page.waitForSelector(responseSelector, { timeout: 180000 });

        let previousLength = 0;
        let currentLength = 0;
        let responseComplete = false;
        let response = '';
        const maxChecks = 60; // Max checks to prevent infinite loop
        let checkCount = 0;

        while (!responseComplete && checkCount < maxChecks) {
            checkCount++;
            await page.waitForTimeout(1000); // Wait for a second before checking again

            // Get the response text so far
            response = await page.evaluate(() => {
                const responseElement = document.querySelector('div[data-message-author-role="assistant"] .markdown.prose');
                return responseElement ? responseElement.innerText : '';
            });

            currentLength = response.length;

            // Check if the length of the response has stopped changing
            if (currentLength === previousLength) {
                responseComplete = true;
            } else {
                previousLength = currentLength;
            }

            console.log(`Check ${checkCount}: response length = ${currentLength}`);
        }

        if (checkCount >= maxChecks) {
            console.warn('Max checks reached, response might be incomplete.');
        }

        console.log('Response:', response);

        await browser.close();
        return response || 'No response found';
    } catch (error) {
        console.error('Error in Puppeteer script:', error);

        // Capture screenshot on error (optional)
        try {
            await page.screenshot({ path: 'error_screenshot.png' });
        } catch (screenshotError) {
            console.error('Error capturing screenshot:', screenshotError);
        }

        await browser.close();
        throw error;
    }
}

module.exports = { askChatGPT };

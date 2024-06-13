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
        await page.goto('https://chat.openai.com/chat', { waitUntil: 'networkidle2', timeout: 120000 });

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

        // Wait for the send button to become enabled
        await page.waitForFunction(() => {
            const sendButton = document.querySelector('button[data-testid="fruitjuice-send-button"]');
            return sendButton && !sendButton.disabled;
        }, { timeout: 60000 });

        // Click the send button
        await page.click('button[data-testid="fruitjuice-send-button"]');

        // Wait for the response and continuously check for completion
        const responseSelector = 'div[data-message-author-role="assistant"] .markdown.prose';
        await page.waitForSelector(responseSelector, { timeout: 60000 });

        // Continuously check if the response is still loading
        let responseComplete = false;
        let response = '';
        let maxChecks = 60; // Max checks to prevent infinite loop
        let checkCount = 0;
        
        while (!responseComplete && checkCount < maxChecks) {
            checkCount++;
            await page.waitForTimeout(1000); // Wait for a second before checking again

            responseComplete = await page.evaluate(() => {
                const loadingSpinner = document.querySelector('button[data-testid="fruitjuice-send-button"] svg[role="status"]');
                return !loadingSpinner; // Response is complete when spinner is not present
            });

            console.log(`Check ${checkCount}: responseComplete = ${responseComplete}`);

            // Scroll to the bottom of the page to load any lazy-loaded content
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            
            // Get the response so far
            response = await page.evaluate(() => {
                const responseElements = document.querySelectorAll('div[data-message-author-role="assistant"] .markdown.prose');
                return Array.from(responseElements).map(el => el.innerText).join('\n');
            });

            console.log(`Partial response after check ${checkCount}: ${response}`);
        }

        if (checkCount >= maxChecks) {
            console.warn('Max checks reached, response might be incomplete.');
        }

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

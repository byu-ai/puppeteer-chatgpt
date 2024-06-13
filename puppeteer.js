const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

async function askChatGPT(prompt) {
    console.log('Launching browser...');
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
        console.log('Cookies loaded');
    } else {
        console.log('Cookies file not found');
    }

    try {
        console.log('Navigating to ChatGPT page...');
        await page.goto('https://chat.openai.com/chat', { waitUntil: 'networkidle2', timeout: 180000 });
        console.log('Page loaded');

        // Wait for potential dynamic content to load
        await page.waitForTimeout(5000);
        
        // Check if the prompt input field is present in the page content
        const promptInputExists = await page.evaluate(() => {
            return !!document.querySelector('textarea[placeholder="Message ChatGPT"]');
        });

        if (!promptInputExists) {
            // Log the page content for debugging
            const content = await page.content();
            console.log(content);
            throw new Error('Prompt textarea is not present on the page');
        }

        console.log('Prompt textarea is present');

        // Wait for the initial elements to ensure the page is loaded
        await page.waitForSelector('textarea[placeholder="Message ChatGPT"]', { timeout: 120000 });
        console.log('Prompt textarea is ready');

        // Type the prompt into the textarea
        await page.type('textarea[placeholder="Message ChatGPT"]', prompt);
        console.log('Prompt typed');

        // Additional logging for send button state
        const sendButtonState = await page.evaluate(() => {
            const sendButton = document.querySelector('button[data-testid="fruitjuice-send-button"]');
            if (sendButton) {
                return {
                    exists: true,
                    disabled: sendButton.disabled,
                    class: sendButton.className,
                    text: sendButton.innerText,
                };
            }
            return { exists: false, disabled: true };
        });
        console.log('Send button state:', sendButtonState);

        if (sendButtonState.exists && sendButtonState.disabled) {
            console.log('Send button is disabled. Attempting to click it...');
            await page.click('button[data-testid="fruitjuice-send-button"]');
            console.log('Clicked the send button');
        } else if (sendButtonState.exists) {
            console.log('Send button is enabled. Clicking it...');
            await page.click('button[data-testid="fruitjuice-send-button"]');
            console.log('Send button clicked');
        } else {
            throw new Error('Send button is not present');
        }

        // Wait for the response and check for completeness
        const responseSelector = 'div[data-message-author-role="assistant"] .markdown.prose';
        await page.waitForSelector(responseSelector, { timeout: 180000 });
        console.log('Response selector found');

        let previousLength = 0;
        let responseComplete = false;
        let response = '';
        const maxChecks = 120; // Max checks to prevent infinite loop
        let checkCount = 0;

        while (!responseComplete && checkCount < maxChecks) {
            checkCount++;
            await page.waitForTimeout(2000); // Wait for 2 seconds before checking again

            // Get the response text so far
            response = await page.evaluate(() => {
                const responseElement = document.querySelector('div[data-message-author-role="assistant"] .markdown.prose');
                return responseElement ? responseElement.innerText : '';
            });

            // Check if the length of the response has stopped changing
            if (response.length === previousLength) {
                responseComplete = true;
            } else {
                previousLength = response.length;
            }

            console.log(`Check ${checkCount}: response length = ${response.length}`);
        }

        if (checkCount >= maxChecks) {
            console.warn('Max checks reached, response might be incomplete.');
        }

        await browser.close();
        return response || 'No response found';
    } catch (error) {
        console.error('Error in Puppeteer script:', error);

        // Capture screenshot on error (optional)
        try {
            await page.screenshot({ path: 'error_screenshot.png' });
            console.log('Screenshot captured');
        } catch (screenshotError) {
            console.error('Error capturing screenshot:', screenshotError);
        }

        await browser.close();
        throw error;
    }
}

module.exports = { askChatGPT };

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
            '--single-process',
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
        const maxRetries = 3;
        let attempt = 0;
        let success = false;

        while (attempt < maxRetries && !success) {
            try {
                console.log(`Navigating to ChatGPT page (attempt ${attempt + 1})...`);
                await page.goto('https://chat.openai.com/chat', { waitUntil: 'networkidle2', timeout: 90000 });
                console.log('Page loaded');
                success = true;
            } catch (error) {
                console.error(`Navigation attempt ${attempt + 1} failed:`, error);
                attempt++;
                if (attempt >= maxRetries) {
                    throw new Error('Failed to navigate to ChatGPT page after multiple attempts');
                }
            }
        }

        // Wait for potential dynamic content to load
        await page.waitForTimeout(5000);

        // Check if the prompt input field is present in the page content
        const promptInputExists = await page.evaluate(() => {
            return !!document.querySelector('textarea[placeholder="Message ChatGPT"]');
        });

        if (!promptInputExists) {
            console.log('Detected Cloudflare challenge or other issue. Attempting to solve...');
            // Log the page content for debugging
            const content = await page.content();
            console.log(content);

            // Capture screenshot
            await page.screenshot({ path: 'cloudflare_challenge.png' });

            // Retry navigation to bypass challenge
            await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"], timeout: 90000 });
            await page.waitForTimeout(5000);

            // Recheck for prompt textarea
            const promptInputExistsRetry = await page.evaluate(() => {
                return !!document.querySelector('textarea[placeholder="Message ChatGPT"]');
            });

            if (!promptInputExistsRetry) {
                throw new Error('Prompt textarea is not present on the page after retry');
            }
        }

        console.log('Prompt textarea is present');

        // Wait for the initial elements to ensure the page is loaded
        await page.waitForSelector('textarea[placeholder="Message ChatGPT"]', { timeout: 60000 });
        console.log('Prompt textarea is ready');

        // Directly set the value of the textarea
        console.log('Setting prompt value directly...');
        const startTypingTime = Date.now();
        await page.evaluate((promptText) => {
            document.querySelector('textarea[placeholder="Message ChatGPT"]').value = promptText;
        }, prompt);
        console.log('Prompt value set');

        // Dispatch input event to ensure any necessary event listeners are triggered
        await page.evaluate(() => {
            const event = new Event('input', { bubbles: true });
            document.querySelector('textarea[placeholder="Message ChatGPT"]').dispatchEvent(event);
        });

        const endTypingTime = Date.now();
        console.log(`Setting duration: ${(endTypingTime - startTypingTime) / 1000} seconds`);

        // Click the send button immediately after setting the prompt
        await page.waitForSelector('button[data-testid="fruitjuice-send-button"]', { timeout: 10000 });
        await page.click('button[data-testid="fruitjuice-send-button"]');
        console.log('Clicked the send button');

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

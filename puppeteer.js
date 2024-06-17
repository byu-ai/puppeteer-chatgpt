const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents'); // Added user-agents package
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
            '--single-process',
            '--disable-gpu'
        ]
    });

    const page = await browser.newPage();

    // Set a realistic user-agent
    const userAgent = new UserAgent(); // Use user-agents to set a realistic user-agent string
    await page.setUserAgent(userAgent.toString()); // Set the user-agent

    // Load cookies from the JSON file
    const cookiesPath = path.resolve(__dirname, 'cookies.json');
    if (fs.existsSync(cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        await page.setCookie(...cookies);
    }

    try {
        await page.goto('https://chat.openai.com/chat', { waitUntil: 'networkidle2', timeout: 90000 });

        await page.waitForTimeout(5000);

        const promptInputExists = await page.evaluate(() => {
            return !!document.querySelector('textarea[placeholder="Message ChatGPT"]');
        });

        if (!promptInputExists) {
            // Log the page content for debugging
            const content = await page.content();
            console.log(content);

            // Capture screenshot
            await page.screenshot({ path: 'cloudflare_challenge.png' });

            // Retry navigation to bypass challenge
            await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"], timeout: 90000 });
            await page.waitForTimeout(5000);

            const promptInputExistsRetry = await page.evaluate(() => {
                return !!document.querySelector('textarea[placeholder="Message ChatGPT"]');
            });

            if (!promptInputExistsRetry) {
                throw new Error('Prompt textarea is not present on the page after retry');
            }
        }

        await page.waitForSelector('textarea[placeholder="Message ChatGPT"]', { timeout: 60000 });

        // Directly set the value of the textarea without a delay
        await page.evaluate((promptText) => {
            const textarea = document.querySelector('textarea[placeholder="Message ChatGPT"]');
            textarea.value = promptText;
            const event = new Event('input', { bubbles: true });
            textarea.dispatchEvent(event);
        }, prompt);

        await page.waitForSelector('button[data-testid="fruitjuice-send-button"]', { timeout: 10000 });
        await page.click('button[data-testid="fruitjuice-send-button"]');

        const responseSelector = 'div[data-message-author-role="assistant"] .markdown.prose';
        await page.waitForSelector(responseSelector, { timeout: 300000 });

        let previousLength = 0;
        let responseComplete = false;
        let response = '';
        const maxChecks = 300;
        let checkCount = 0;

        while (!responseComplete && checkCount < maxChecks) {
            checkCount++;
            await page.waitForTimeout(2000);

            response = await page.evaluate(() => {
                const responseElement = document.querySelector('div[data-message-author-role="assistant"] .markdown.prose');
                return responseElement ? responseElement.innerText : '';
            });

            if (response.length === previousLength) {
                responseComplete = true;
            } else {
                previousLength = response.length;
            }
        }

        if (checkCount >= maxChecks) {
            console.warn('Max checks reached, response might be incomplete.');
        }

        await browser.close();
        return response || 'No response found';
    } catch (error) {
        console.error('Error in Puppeteer script:', error);
        await page.screenshot({ path: 'error_screenshot.png' });
        await browser.close();
        throw error;
    }
}

module.exports = { askChatGPT };

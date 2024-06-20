const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const fs = require('fs');
const path = require('path');
const cloudscraper = require('cloudscraper');

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
    const userAgent = new UserAgent();
    await page.setUserAgent(userAgent.toString());

    // Load cookies from the JSON file
    const cookiesPath = path.resolve(__dirname, 'cookies.json');
    if (fs.existsSync(cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        await page.setCookie(...cookies);
    }

    // Load local storage from the JSON file
    const localStoragePath = path.resolve(__dirname, 'localStorage.json');
    if (fs.existsSync(localStoragePath)) {
        const localStorage = JSON.parse(fs.readFileSync(localStoragePath, 'utf8'));
        await page.evaluate(localStorage => {
            for (const [key, value] of Object.entries(localStorage)) {
                localStorage.setItem(key, value);
            }
        }, localStorage);
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

        // Save cookies and local storage to files
        const cookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

        const localStorageData = await page.evaluate(() => {
            let localStorageData = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                localStorageData[key] = localStorage.getItem(key);
            }
            return localStorageData;
        });
        fs.writeFileSync(localStoragePath, JSON.stringify(localStorageData, null, 2));

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


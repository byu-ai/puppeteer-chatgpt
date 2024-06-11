const puppeteer = require('puppeteer');

async function askChatGPT(prompt) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    try {
        console.log('Navigating to ChatGPT...');
        await page.goto('https://chat.openai.com/', { waitUntil: 'networkidle2' });

        // Check if login page is displayed and handle login
        const loginSelector = 'button[data-testid="login"]';
        const emailSelector = 'input[name="email"]';
        const passwordSelector = 'input[name="password"]';
        const loginButtonSelector = 'button[type="submit"]';

        if (await page.$(loginSelector)) {
            console.log('Login page detected, attempting to log in...');
            await page.click(loginSelector);

            await page.waitForSelector(emailSelector, { timeout: 60000 });
            await page.type(emailSelector, 'your-email@example.com');  // Replace with your email
            await page.type(passwordSelector, 'your-password');  // Replace with your password
            await page.click(loginButtonSelector);

            await page.waitForNavigation({ waitUntil: 'networkidle2' });
        }

        console.log('Waiting for the text area...');
        await page.waitForSelector('#prompt-textarea', { timeout: 90000 });

        console.log('Entering prompt...');
        await page.type('#prompt-textarea', prompt);

        console.log('Sending the prompt...');
        await page.click('button[data-testid="send-button"]');

        await page.waitForSelector('.message-wrapper', { timeout: 90000 });

        const response = await page.evaluate(() => {
            const messages = Array.from(document.querySelectorAll('.message-wrapper'));
            return messages[messages.length - 1].innerText;
        });

        console.log('Response received:', response);
        await browser.close();
        return response;
    } catch (error) {
        console.error('Error in Puppeteer script:', error);
        await browser.close();
        throw error;
    }
}

module.exports = askChatGPT;

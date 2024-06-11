const puppeteer = require('puppeteer');

async function askChatGPT(prompt) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        console.log('Navigating to ChatGPT...');
        await page.goto('https://chat.openai.com/chat', { waitUntil: 'networkidle2' });

        // Check if login page is displayed
        const loginSelector = 'button[data-testid="login"]';
        const emailSelector = 'input[name="email"]';
        const passwordSelector = 'input[name="password"]';
        const loginButtonSelector = 'button[type="submit"]';

        if (await page.$(loginSelector)) {
            console.log('Login page detected, attempting to log in...');
            await page.click(loginSelector);

            await page.waitForSelector(emailSelector, { timeout: 60000 });
            await page.type(emailSelector, 'adalenh25@gmail.com');
            await page.type(passwordSelector, 'chatGPTpassword');
            await page.click(loginButtonSelector);

            await page.waitForNavigation({ waitUntil: 'networkidle2' });
        }

        console.log('Waiting for the text area...');
        await page.waitForSelector('textarea', { timeout: 60000 });

        console.log('Typing the prompt...');
        await page.type('textarea', prompt);
        await page.keyboard.press('Enter');

        console.log('Waiting for the response...');
        await page.waitForSelector('.response-class', { timeout: 60000 });  // Update the correct response selector

        console.log('Extracting the response...');
        const response = await page.evaluate(() => {
            const responseElement = document.querySelector('.response-class');  // Update the correct response selector
            return responseElement ? responseElement.innerText : 'No response';
        });

        await browser.close();
        console.log('Response:', response);
        return response;
    } catch (error) {
        console.error('Error in Puppeteer script:', error);
        await browser.close();
        throw error;
    }
}

module.exports = askChatGPT;

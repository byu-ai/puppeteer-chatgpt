const puppeteer = require('puppeteer');

async function askChatGPT(prompt) {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();

    try {
        console.log('Navigating to ChatGPT...');
        await page.goto('https://chat.openai.com/chat');

        console.log('Waiting for the text area...');
        await page.waitForSelector('textarea');

        console.log('Typing the prompt...');
        await page.type('textarea', prompt);
        await page.keyboard.press('Enter');

        console.log('Waiting for the response...');
        await page.waitForSelector('.response-class', { timeout: 60000 });

        console.log('Extracting the response...');
        const response = await page.evaluate(() => {
            const responseElement = document.querySelector('.response-class');
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

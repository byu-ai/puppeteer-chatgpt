const puppeteer = require('puppeteer-core');
const path = require('path');
const { install, getExecutablePath } = require('@puppeteer/browsers');

async function askChatGPT(prompt) {
    const revision = '982053'; // Known-good revision
    const browser = 'chromium';

    // Install Chromium
    await install({
        browser,
        buildId: revision,
        cacheDir: path.join(__dirname, '.local-chromium')
    });

    // Get the executable path of Chromium
    const executablePath = getExecutablePath(browser, revision);

    const browserInstance = await puppeteer.launch({
        executablePath,
        args: ['--no-sandbox']
    });
    const page = await browserInstance.newPage();

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

        await browserInstance.close();
        console.log('Response:', response);
        return response;
    } catch (error) {
        console.error('Error in Puppeteer script:', error);
        await browserInstance.close();
        throw error;
    }
}

module.exports = askChatGPT;

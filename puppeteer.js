const puppeteer = require('puppeteer');

async function askChatGPT(prompt) {
    const browser = await puppeteer.launch({ headless: false }); // Run in headful mode for debugging
    const page = await browser.newPage();

    try {
        // Go to the ChatGPT chat page directly
        await page.goto('https://chat.openai.com/chat', { waitUntil: 'networkidle2' });

        // Wait for the initial elements to ensure the page is loaded
        await page.waitForSelector('textarea[placeholder="Message ChatGPT"]', { timeout: 60000 });

        // Check if the prompt input field is visible
        const isVisible = await page.evaluate(() => {
            const textarea = document.querySelector('textarea[placeholder="Message ChatGPT"]');
            return textarea && textarea.offsetParent !== null;
        });

        if (!isVisible) {
            throw new Error('Prompt textarea is not visible on the page');
        }

        // Type the prompt into the textarea
        await page.type('textarea[placeholder="Message ChatGPT"]', prompt);

        // Click the send button or press Enter
        await page.click('button[data-testid="send-button"]');

        // Wait for the response
        await page.waitForSelector('div[data-message-author-role="assistant"] .markdown.prose', { timeout: 60000 });

        // Extract the response text
        const response = await page.evaluate(() => {
            const responseElement = document.querySelector('div[data-message-author-role="assistant"] .markdown.prose');
            return responseElement ? responseElement.innerText : 'No response found';
        });

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

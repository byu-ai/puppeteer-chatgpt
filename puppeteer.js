const puppeteer = require('puppeteer');

async function askChatGPT(prompt) {
    const browser = await puppeteer.launch({ headless: true }); // Change to false if you want to see the browser
    const page = await browser.newPage();

    try {
        // Go to the ChatGPT chat page directly
        await page.goto('https://chat.openai.com/chat', { waitUntil: 'networkidle2' });

        // Wait for the textarea to be visible
        await page.waitForSelector('#prompt-textarea', { timeout: 60000 });
        await page.type('#prompt-textarea', prompt);

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
        await browser.close();
        throw error;
    }
}

module.exports = { askChatGPT };

const puppeteer = require('puppeteer');

async function askChatGPT(prompt) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('https://chat.openai.com');

    // Wait for the textarea to be visible
    await page.waitForSelector('#prompt-textarea');
    await page.type('#prompt-textarea', prompt);

    // Click the send button
    await page.click('button[data-testid="send-button"]');

    // Wait for the response
    await page.waitForSelector('div[data-message-author-role="assistant"] .markdown.prose');

    // Extract the response text
    const response = await page.evaluate(() => {
        const responseElement = document.querySelector('div[data-message-author-role="assistant"] .markdown.prose');
        return responseElement.innerText;
    });

    await browser.close();
    return response;
}

module.exports = { askChatGPT };

const puppeteer = require('puppeteer');

async function askChatGPT(prompt) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Go to the ChatGPT login page and log in
    await page.goto('https://chat.openai.com');
    
    // Wait for the login form and fill it out
    await page.waitForSelector('input[name="username"]');
    await page.type('input[name="username"]', process.env.OPENAI_USERNAME);
    await page.type('input[name="password"]', process.env.OPENAI_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for the page to fully load
    await page.waitForNavigation();
    
    // Navigate to the chat page
    await page.goto('https://chat.openai.com/chat');
    
    // Wait for the textarea to be visible
    await page.waitForSelector('textarea');
    await page.type('textarea', prompt);
    
    // Click the send button
    await page.keyboard.press('Enter');
    
    // Wait for the response
    await page.waitForSelector('div[data-message-author-role="assistant"] .markdown.prose');
    
    // Extract the response text
    const response = await page.evaluate(() => {
        const responseElement = document.querySelector('div[data-message-author-role="assistant"] .markdown.prose');
        return responseElement ? responseElement.innerText : 'No response found';
    });

    await browser.close();
    return response;
}

module.exports = { askChatGPT };

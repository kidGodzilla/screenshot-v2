const chrome = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

async function getScreenshot(url, type, quality, fullPage, viewport, wait) {
    const browser = await puppeteer.launch({
        args: chrome.args,
        executablePath: await chrome.executablePath,
        headless: chrome.headless,
    });

    const page = await browser.newPage();
    if (viewport) await page.setViewport(viewport);
    // console.log('Taking a shot of:', url);
    await page.goto(url, { timeout: 10000 });
    if (wait) await page.waitFor(parseInt(wait) * 1000);

    const file = await page.screenshot({ type,  quality, fullPage });
    await browser.close();
    return file;
}

module.exports = { getScreenshot };
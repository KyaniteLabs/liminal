const puppeteer = require('puppeteer');
const fs = require('fs');

async function captureScreenshot(htmlPath, outputPath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('file://' + htmlPath);
  await page.waitForSelector('canvas', { timeout: 10000 });
  await new Promise(resolve => setTimeout(resolve, 3000));

  const canvas = await page.$('canvas');

  if (canvas) {
    await canvas.screenshot({ path: outputPath });
    console.log(`Screenshot saved: ${outputPath}`);
  } else {
    await page.screenshot({ path: outputPath });
    console.log(`Full page screenshot saved: ${outputPath}`);
  }

  await browser.close();
}

// Get HTML path from command line
const htmlPath = process.argv[2];
const outputPath = process.argv[3];

if (!htmlPath || !outputPath) {
  console.error('Usage: node capture.cjs <htmlPath> <outputPath>');
  process.exit(1);
}

captureScreenshot(htmlPath, outputPath).catch(console.error);

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.GUI_URL || 'http://localhost:5673';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(process.cwd(), '.omx', 'proof', `studio-creative-conversation-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });
const prompt = process.env.STUDIO_PROMPT || 'Create a p5.js sketch of a quiet moonlit garden where blue-green fireflies orbit a dark pond; make the motion visible and soothing.';
const revision = process.env.STUDIO_REVISION || 'Make it darker, slower, and more spacious while preserving the fireflies and pond.';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
const consoleMessages = [];
const pageErrors = [];
page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));
page.on('pageerror', (err) => pageErrors.push(err.message));

async function snapshot(name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
}

async function readState() {
  return await page.evaluate(() => {
    const body = document.body.innerText;
    const iframe = document.querySelector('.sinter-preview-panel iframe');
    const srcdoc = iframe?.getAttribute('srcdoc') || '';
    const img = document.querySelector('.sinter-preview-panel img');
    const code = document.querySelector('.sinter-stage-code');
    return {
      body: body.slice(0, 12000),
      hasPreviewIframe: Boolean(iframe),
      hasPreviewImage: Boolean(img),
      hasCodePreview: Boolean(code),
      srcdocLength: srcdoc.length,
      srcdocHasP5: /p5\.min\.js|createCanvas|data-sinter-sync-preview="p5"/i.test(srcdoc),
      srcdocHasThree: /THREE\.|three\.module|data-sinter-sync-preview="three"/i.test(srcdoc),
      hasClarification: /Answer needed|Answer and generate/i.test(body),
      hasRevision: /Preview ready|Adjust direction|New variation|Polish/i.test(body),
      hasError: /Preview unavailable|error|failed|disconnected/i.test(body),
      runButtonText: document.querySelector('.sinter-run-button')?.textContent?.trim() || '',
      runButtonDisabled: Boolean(document.querySelector('.sinter-run-button')?.disabled),
    };
  });
}

async function waitForPreview(label, timeoutMs = 240000) {
  const started = Date.now();
  let last = await readState();
  while (Date.now() - started < timeoutMs) {
    last = await readState();
    fs.writeFileSync(path.join(outDir, `${label}-latest.json`), JSON.stringify(last, null, 2));
    if (last.hasClarification) {
      const input = page.locator('.sinter-clarification input');
      if (await input.count()) {
        await input.fill('A calm nocturne: dark pond, blue-green fireflies, slow orbital movement, minimal text, no harsh flashes.');
        await page.getByRole('button', { name: 'Answer and generate' }).click();
      }
    }
    if (last.hasPreviewIframe || last.hasPreviewImage || last.hasCodePreview) return last;
    if (last.hasError && Date.now() - started > 45000) return last;
    await page.waitForTimeout(2500);
  }
  return last;
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.sinter-workbench', { timeout: 30000 });
  await snapshot('01-home');

  await page.fill('#workbench-prompt', prompt);
  await page.waitForFunction(() => {
    const button = document.querySelector('.sinter-run-button');
    return button && !button.disabled;
  }, null, { timeout: 30000 });
  await snapshot('02-prompt-filled');
  await page.click('.sinter-run-button');
  const first = await waitForPreview('first');
  await page.waitForTimeout(2000);
  await snapshot('03-first-preview');

  let second = null;
  if (first.hasPreviewIframe || first.hasPreviewImage || first.hasCodePreview) {
    await page.fill('#workbench-prompt', revision);
    await page.waitForFunction(() => {
      const button = document.querySelector('.sinter-run-button');
      return button && !button.disabled;
    }, null, { timeout: 30000 });
    await snapshot('04-revision-prompt-filled');
    await page.click('.sinter-run-button');
    second = await waitForPreview('revision');
    await page.waitForTimeout(2000);
    await snapshot('05-revision-preview');
  }

  const finalState = await readState();
  const receipt = {
    generatedAt: new Date().toISOString(),
    url,
    prompt,
    revisionAttempted: Boolean(second),
    revision,
    first: {
      hasPreviewIframe: first.hasPreviewIframe,
      hasPreviewImage: first.hasPreviewImage,
      hasCodePreview: first.hasCodePreview,
      srcdocLength: first.srcdocLength,
      srcdocHasP5: first.srcdocHasP5,
      srcdocHasThree: first.srcdocHasThree,
      hasClarification: first.hasClarification,
      hasError: first.hasError,
    },
    revisionResult: second ? {
      hasPreviewIframe: second.hasPreviewIframe,
      hasPreviewImage: second.hasPreviewImage,
      hasCodePreview: second.hasCodePreview,
      srcdocLength: second.srcdocLength,
      srcdocHasP5: second.srcdocHasP5,
      srcdocHasThree: second.srcdocHasThree,
      hasError: second.hasError,
    } : null,
    final: {
      hasPreviewIframe: finalState.hasPreviewIframe,
      hasPreviewImage: finalState.hasPreviewImage,
      hasCodePreview: finalState.hasCodePreview,
      srcdocLength: finalState.srcdocLength,
      srcdocHasP5: finalState.srcdocHasP5,
      srcdocHasThree: finalState.srcdocHasThree,
      hasRevision: finalState.hasRevision,
      hasError: finalState.hasError,
      bodySample: finalState.body.slice(0, 2500),
    },
    consoleMessages,
    pageErrors,
    outDir,
  };
  fs.writeFileSync(path.join(outDir, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
  const firstOk = first.hasPreviewIframe && first.srcdocHasP5 && !first.srcdocHasThree && !first.hasError;
  const secondOk = !second || (second.hasPreviewIframe && second.srcdocHasP5 && !second.srcdocHasThree && !second.hasError);
  if (!firstOk || !secondOk || pageErrors.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}

import { chromium, Browser } from 'playwright';

let browser: Browser | null = null;

export async function initPlaywright(): Promise<void> {
  if (browser) return;

  browser = await chromium.launch({
    headless: true
  });

  console.log('[playwright] Chromium launched');
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  if (!browser) {
    await initPlaywright();
  }

  if (!browser) {
    throw new Error('Playwright browser not initialized after initPlaywright().');
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.setContent(html, {
      waitUntil: 'load'
    });

    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm'
      }
    });
    return Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
  } catch (err) {
    console.error('[playwright] htmlToPdf error:', err);
    throw err;
  } finally {
    await context.close();
  }
}

export async function closePlaywright(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('[playwright] Chromium closed');
  }
}

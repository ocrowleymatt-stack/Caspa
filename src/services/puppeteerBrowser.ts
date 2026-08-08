/**
 * Single shared Puppeteer browser for every server-side PDF path
 * (caspa-export routes + PDFAssemblyService). One launch config, one process —
 * instead of each pipeline launching and managing its own Chromium.
 *
 * Honours PUPPETEER_EXECUTABLE_PATH; otherwise uses the bundled Chromium.
 */
import puppeteer from 'puppeteer';

type Browser = Awaited<ReturnType<typeof puppeteer.launch>>;

let browserInstance: Browser | null = null;
let launching: Promise<Browser> | null = null;

export async function getSharedBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) return browserInstance;

  // Coalesce concurrent launches so we never spawn two browsers under load.
  if (!launching) {
    launching = puppeteer
      .launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      })
      .then((b) => {
        browserInstance = b;
        launching = null;
        return b;
      })
      .catch((err) => {
        launching = null;
        throw err;
      });
  }
  return launching;
}

export async function closeSharedBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

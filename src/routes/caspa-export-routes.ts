/**
 * Caspa server-side PDF export — screen and print-ready
 */

import express from 'express';
import puppeteer from 'puppeteer';

const router = express.Router();

let browserInstance: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
  }
  return browserInstance;
}

type PdfProfile = 'screen-pdf' | 'kdp-novel' | 'course-book' | 'subject-bible' | 'professional-print';

function pdfOptions(profile: PdfProfile) {
  if (profile === 'kdp-novel' || profile === 'professional-print') {
    return {
      width: '6in',
      height: '9in',
      margin: { top: '0.75in', bottom: '0.75in', left: '0.6in', right: '0.6in' },
      printBackground: true,
      preferCSSPageSize: true,
      scale: profile === 'professional-print' ? 1 : 0.98,
    };
  }

  if (profile === 'course-book' || profile === 'subject-bible') {
    return {
      format: 'A4' as const,
      margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
      printBackground: true,
      preferCSSPageSize: true,
    };
  }

  return {
    format: 'letter' as const,
    margin: { top: '0.75in', bottom: '0.75in', left: '0.75in', right: '0.75in' },
    printBackground: true,
  };
}

router.post('/pdf', async (req, res) => {
  try {
    const { html, profile = 'screen-pdf', filename = 'caspa-export.pdf' } = req.body;

    if (!html?.trim()) {
      return res.status(400).json({ success: false, message: 'HTML content required' });
    }

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });

      const opts = pdfOptions(profile as PdfProfile);
      const buffer = await page.pdf(opts);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Caspa-Export-Profile', profile);
      if (profile === 'professional-print') {
        res.setHeader('X-Caspa-Print-Ready', 'true');
        res.setHeader('X-Caspa-Print-Notes', '300DPI-equivalent render; verify CMYK with print provider before KDP upload');
      }
      res.send(Buffer.from(buffer));
    } finally {
      await page.close();
    }
  } catch (err: unknown) {
    console.error('[Caspa Export] PDF error:', err);
    const message = err instanceof Error ? err.message : 'PDF generation failed';
    return res.status(500).json({ success: false, message });
  }
});

export default router;

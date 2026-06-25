import fs from 'fs/promises';
import path from 'path';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
import {
  getConfig,
  readCollection,
  findById,
  type Chapter,
  type Project,
} from '../../shared';

export interface PDFOptions {
  pageSize: 'A4' | '5x8' | '6x9' | '8.5x11';
  fontSize: number;
  lineSpacing: number;
  margins: { top: number; bottom: number; left: number; right: number };
  includeTableOfContents: boolean;
  includeChapterNumbers: boolean;
  headerStyle: 'title' | 'author' | 'both' | 'none';
  footerStyle: 'pageNumber' | 'none';
  font: 'Georgia' | 'Times New Roman' | 'Garamond' | 'Palatino';
}

export interface CoverOptions {
  title: string;
  subtitle?: string;
  author: string;
  backgroundColor: string;
  textColor: string;
}

const PAGE_SIZES: Record<PDFOptions['pageSize'], [number, number]> = {
  A4: [595.28, 841.89],
  '5x8': [360, 576],
  '6x9': [432, 648],
  '8.5x11': [612, 792],
};

function parseHexColor(hex: string): RGB {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized.padEnd(6, '0').slice(0, 6);
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

async function resolveFont(
  pdfDoc: PDFDocument,
  fontName: PDFOptions['font'],
): Promise<PDFFont> {
  switch (fontName) {
    case 'Georgia':
    case 'Garamond':
    case 'Palatino':
    case 'Times New Roman':
    default:
      return await pdfDoc.embedFont(StandardFonts.TimesRoman);
  }
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [''];
}

export class PDFAssembler {
  private async getProjectChapters(projectId: string): Promise<Chapter[]> {
    const chapters = await readCollection<Chapter>('chapters');
    return chapters
      .filter((chapter) => chapter.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  }

  async assemblePDF(projectId: string, options: PDFOptions): Promise<string> {
    const project = await findById<Project>('projects', projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const chapters = await this.getProjectChapters(projectId);
    const [pageWidth, pageHeight] = PAGE_SIZES[options.pageSize];
    const pdfDoc = await PDFDocument.create();
    const font = await resolveFont(pdfDoc, options.font);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const lineHeight = options.fontSize * options.lineSpacing;
    const contentWidth =
      pageWidth - options.margins.left - options.margins.right;
    let pageNumber = 0;

    const addPage = (): PDFPage => {
      pageNumber += 1;
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const headerY = pageHeight - options.margins.top + 10;

      if (options.headerStyle === 'title' || options.headerStyle === 'both') {
        page.drawText(project.title, {
          x: options.margins.left,
          y: headerY,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      if (options.headerStyle === 'author' || options.headerStyle === 'both') {
        const text = project.title;
        const textWidth = font.widthOfTextAtSize(text, 9);
        page.drawText(text, {
          x: pageWidth - options.margins.right - textWidth,
          y: headerY,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      if (options.footerStyle === 'pageNumber') {
        const label = String(pageNumber);
        const labelWidth = font.widthOfTextAtSize(label, 9);
        page.drawText(label, {
          x: (pageWidth - labelWidth) / 2,
          y: options.margins.bottom - 20,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      return page;
    };

    if (options.includeTableOfContents && chapters.length > 0) {
      let page = addPage();
      let y = pageHeight - options.margins.top - 20;

      page.drawText('Table of Contents', {
        x: options.margins.left,
        y,
        size: options.fontSize + 4,
        font: boldFont,
      });
      y -= lineHeight * 2;

      for (let i = 0; i < chapters.length; i += 1) {
        const chapter = chapters[i];
        const label = options.includeChapterNumbers
          ? `${i + 1}. ${chapter.title}`
          : chapter.title;

        if (y < options.margins.bottom + lineHeight) {
          page = addPage();
          y = pageHeight - options.margins.top - 20;
        }

        page.drawText(label, {
          x: options.margins.left,
          y,
          size: options.fontSize,
          font,
        });
        y -= lineHeight;
      }
    }

    for (let i = 0; i < chapters.length; i += 1) {
      const chapter = chapters[i];
      let page = addPage();
      let y = pageHeight - options.margins.top - 20;

      const heading = options.includeChapterNumbers
        ? `Chapter ${i + 1}: ${chapter.title}`
        : chapter.title;

      page.drawText(heading, {
        x: options.margins.left,
        y,
        size: options.fontSize + 2,
        font: boldFont,
      });
      y -= lineHeight * 2;

      const paragraphs = chapter.content.split(/\n+/);
      for (const paragraph of paragraphs) {
        const lines = wrapText(paragraph.trim(), font, options.fontSize, contentWidth);
        for (const line of lines) {
          if (y < options.margins.bottom + lineHeight) {
            page = addPage();
            y = pageHeight - options.margins.top - 20;
          }
          page.drawText(line, {
            x: options.margins.left,
            y,
            size: options.fontSize,
            font,
          });
          y -= lineHeight;
        }
        y -= lineHeight * 0.5;
      }
    }

    const outputDir = path.join(getConfig().dataDir, 'exports', projectId);
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${projectId}-${Date.now()}.pdf`);
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);
    return outputPath;
  }

  async validateCMYK(
    filePath: string,
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      await fs.access(filePath);
    } catch {
      return { valid: false, issues: ['File does not exist'] };
    }

    const bytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
      issues.push('PDF contains no pages');
    }

    const header = bytes.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      issues.push('Invalid PDF header');
    }

    const content = bytes.toString('latin1');
    if (/\/DeviceRGB|\/RGB/i.test(content) && !/\/DeviceCMYK|\/CMYK/i.test(content)) {
      issues.push('PDF appears to use RGB color space; print-ready CMYK may be required');
    }

    if (!/\/DeviceCMYK|\/CMYK/i.test(content)) {
      issues.push('No CMYK color space detected (pdf-lib generates RGB by default)');
    }

    return { valid: issues.length === 0, issues };
  }

  async generateCoverPage(project: Project, options: CoverOptions): Promise<string> {
    const [pageWidth, pageHeight] = PAGE_SIZES['6x9'];
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const font = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const subtitleFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const bg = parseHexColor(options.backgroundColor);
    const fg = parseHexColor(options.textColor);

    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: bg,
    });

    const titleSize = 28;
    const titleWidth = font.widthOfTextAtSize(options.title, titleSize);
    page.drawText(options.title, {
      x: (pageWidth - titleWidth) / 2,
      y: pageHeight * 0.55,
      size: titleSize,
      font,
      color: fg,
    });

    if (options.subtitle) {
      const subtitleSize = 16;
      const subtitleWidth = subtitleFont.widthOfTextAtSize(options.subtitle, subtitleSize);
      page.drawText(options.subtitle, {
        x: (pageWidth - subtitleWidth) / 2,
        y: pageHeight * 0.48,
        size: subtitleSize,
        font: subtitleFont,
        color: fg,
      });
    }

    const authorSize = 18;
    const authorWidth = subtitleFont.widthOfTextAtSize(options.author, authorSize);
    page.drawText(options.author, {
      x: (pageWidth - authorWidth) / 2,
      y: pageHeight * 0.25,
      size: authorSize,
      font: subtitleFont,
      color: fg,
    });

    const outputDir = path.join(getConfig().dataDir, 'exports', project.id);
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${project.id}-cover-${Date.now()}.pdf`);
    await fs.writeFile(outputPath, await pdfDoc.save());
    return outputPath;
  }
}

export const pdfAssembler = new PDFAssembler();

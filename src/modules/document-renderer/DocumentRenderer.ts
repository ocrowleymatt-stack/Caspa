import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface RenderInput {
  title: string;
  content: string;
  format: 'html' | 'markdown';
}

export interface RenderResult {
  html: string;
  markdown: string;
  pdfAvailable: boolean;
  pdfBase64?: string;
  renderedAt: string;
}

export class DocumentRenderer {
  markdownToHtml(md: string): string {
    let html = md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');
    return `<article class="caspa-doc"><p>${html}</p></article>`;
  }

  wrapHtml(title: string, body: string): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
body{font-family:Georgia,serif;max-width:720px;margin:2rem auto;padding:2rem;
background:#0f0f1a;color:#e8e4f0;line-height:1.7}
h1{color:#c9a227;border-bottom:1px solid rgba(201,162,39,.3);padding-bottom:.5rem}
h2{color:#9b87c4} .caspa-doc p{margin-bottom:1rem}
</style></head><body><h1>${title}</h1>${body}</body></html>`;
  }

  async render(input: RenderInput): Promise<RenderResult> {
    const markdown = input.format === 'markdown' ? input.content : input.content;
    const body = input.format === 'html' ? input.content : this.markdownToHtml(markdown);
    const html = input.format === 'html' ? this.wrapHtml(input.title, body) : this.wrapHtml(input.title, body);

    let pdfBase64: string | undefined;
    try {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.TimesRoman);
      const page = pdf.addPage([595, 842]);
      const lines = input.content.slice(0, 2000).split('\n');
      let y = 800;
      page.drawText(input.title.slice(0, 80), { x: 50, y, size: 18, font, color: rgb(0.79, 0.64, 0.15) });
      y -= 30;
      for (const line of lines.slice(0, 40)) {
        if (y < 50) break;
        page.drawText(line.slice(0, 90), { x: 50, y, size: 11, font, color: rgb(0.9, 0.9, 0.95) });
        y -= 14;
      }
      const bytes = await pdf.save();
      pdfBase64 = Buffer.from(bytes).toString('base64');
    } catch {
      pdfBase64 = undefined;
    }

    return {
      html,
      markdown,
      pdfAvailable: Boolean(pdfBase64),
      pdfBase64,
      renderedAt: new Date().toISOString(),
    };
  }
}

export const documentRenderer = new DocumentRenderer();

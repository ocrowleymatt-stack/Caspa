import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  generateId,
  getConfig,
  logger,
  readCollection,
  upsert,
  findById,
} from '../../shared';
import { NotFoundError } from '../manuscript';
import { showFactoryService } from '../show-factory';

export interface Cue {
  id: string;
  order: number;
  label: string;
  type: 'lights' | 'sound' | 'music' | 'actor' | 'props' | 'note';
  timing: 'pre' | 'on' | 'post';
  triggerText: string;
  instruction: string;
  duration?: number;
}

export interface CueList {
  id: string;
  showPackageId: string;
  title: string;
  cues: Cue[];
  createdAt: string;
}

const CUE_LISTS = 'cue-lists';

export class LivePerformanceMode {
  private outputDir(): string {
    return path.join(getConfig().dataDir, 'show-box', 'cue-lists');
  }

  async createCueList(showPackageId: string): Promise<CueList> {
    const pkg = await showFactoryService.getShowPackage(showPackageId);
    const cues: Cue[] = [];

    let cueContent = '';
    const componentCandidates = [
      'lighting-sound-cues.md',
      'cue-list.md',
      'adapted-script.md',
      'radio-script.md',
    ];
    for (const component of componentCandidates) {
      const content = await this.readPackageComponent(showPackageId, component);
      if (content) {
        cueContent = content;
        break;
      }
    }

    if (cueContent) {
      const parsed = this.parseCuesFromMarkdown(cueContent);
      cues.push(...parsed);
    }

    if (cues.length === 0) {
      cues.push(
        {
          id: generateId(),
          order: 1,
          label: 'House to half',
          type: 'lights',
          timing: 'pre',
          triggerText: 'Curtain up',
          instruction: 'Fade house lights to 50%, set stage wash',
        },
        {
          id: generateId(),
          order: 2,
          label: 'Opening music',
          type: 'music',
          timing: 'on',
          triggerText: 'Curtain up',
          instruction: 'Play opening underscore, 30 seconds',
          duration: 30,
        },
        {
          id: generateId(),
          order: 3,
          label: 'Stage ready',
          type: 'actor',
          timing: 'post',
          triggerText: 'First line of dialogue',
          instruction: 'All actors in position, ready for first cue',
        },
      );
    }

    const cueList: CueList = {
      id: generateId(),
      showPackageId,
      title: `${pkg.title} — Cue List`,
      cues,
      createdAt: new Date().toISOString(),
    };

    await upsert(CUE_LISTS, cueList);
    logger.info(`Cue list created: ${cueList.id} for package ${showPackageId}`);
    return cueList;
  }

  async getCueList(id: string): Promise<CueList> {
    const cueList = await findById<CueList>(CUE_LISTS, id);
    if (!cueList) {
      throw new NotFoundError(`Cue list not found: ${id}`);
    }
    return cueList;
  }

  async updateCue(
    cueListId: string,
    cueId: string,
    data: Partial<Cue>,
  ): Promise<Cue> {
    const cueList = await this.getCueList(cueListId);
    const index = cueList.cues.findIndex((cue) => cue.id === cueId);
    if (index === -1) {
      throw new NotFoundError(`Cue not found: ${cueId}`);
    }

    const updated: Cue = {
      ...cueList.cues[index],
      ...data,
      id: cueList.cues[index].id,
      order: data.order ?? cueList.cues[index].order,
    };

    cueList.cues[index] = updated;
    await upsert(CUE_LISTS, cueList);
    return updated;
  }

  async exportCueListAsPDF(id: string): Promise<string> {
    const cueList = await this.getCueList(id);
    await fs.mkdir(this.outputDir(), { recursive: true });

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 50;
    const lineHeight = 16;
    const colWidths = [30, 80, 60, 40, 120, 200];

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const drawText = (
      text: string,
      x: number,
      yPos: number,
      size: number,
      useBold = false,
    ): void => {
      page.drawText(text.slice(0, 80), {
        x,
        y: yPos,
        size,
        font: useBold ? boldFont : font,
        color: rgb(0, 0, 0),
      });
    };

    const newPageIfNeeded = (needed: number): void => {
      if (y - needed < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    drawText(cueList.title, margin, y, 18, true);
    y -= 30;
    drawText(`Show Package: ${cueList.showPackageId}`, margin, y, 10);
    y -= 20;
    drawText(`Generated: ${cueList.createdAt}`, margin, y, 10);
    y -= 30;

    const headers = ['#', 'Label', 'Type', 'Timing', 'Trigger', 'Instruction'];
    let x = margin;
    for (let i = 0; i < headers.length; i += 1) {
      drawText(headers[i], x, y, 9, true);
      x += colWidths[i];
    }
    y -= lineHeight + 4;

    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 10;

    const sortedCues = [...cueList.cues].sort((a, b) => a.order - b.order);
    for (const cue of sortedCues) {
      newPageIfNeeded(lineHeight + 10);
      x = margin;
      const values = [
        String(cue.order),
        cue.label,
        cue.type,
        cue.timing,
        cue.triggerText,
        cue.instruction,
      ];
      for (let i = 0; i < values.length; i += 1) {
        drawText(values[i], x, y, 8);
        x += colWidths[i];
      }
      y -= lineHeight + 4;
    }

    const pdfBytes = await pdfDoc.save();
    const filePath = path.join(this.outputDir(), `${id}.pdf`);
    await fs.writeFile(filePath, pdfBytes);
    logger.info(`Cue list PDF exported: ${filePath}`);
    return filePath;
  }

  async listCueLists(showPackageId?: string): Promise<CueList[]> {
    const lists = await readCollection<CueList>(CUE_LISTS);
    if (showPackageId) {
      return lists.filter((list) => list.showPackageId === showPackageId);
    }
    return lists;
  }

  private parseCuesFromMarkdown(content: string): Cue[] {
    const cues: Cue[] = [];
    const lines = content.split('\n');
    let order = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const cueMatch = trimmed.match(
        /^[-*]?\s*(?:Cue\s*)?(\d+)?[:\.]?\s*(.+?)(?:\s*[-–—]\s*(.+))?$/i,
      );
      if (cueMatch) {
        order += 1;
        const label = cueMatch[2].trim();
        const instruction = cueMatch[3]?.trim() ?? label;
        const type = this.inferCueType(label + instruction);
        cues.push({
          id: generateId(),
          order,
          label: label.slice(0, 60),
          type,
          timing: 'on',
          triggerText: '',
          instruction,
        });
        continue;
      }

      const tableMatch = trimmed.match(/^\|(.+)\|$/);
      if (tableMatch && !trimmed.includes('---')) {
        const cells = tableMatch[1].split('|').map((cell) => cell.trim());
        if (cells.length >= 3 && !cells[0].match(/^(#|order|cue)/i)) {
          order += 1;
          cues.push({
            id: generateId(),
            order,
            label: cells[1] ?? `Cue ${order}`,
            type: this.inferCueType(cells.join(' ')),
            timing: (cells[3] as Cue['timing']) ?? 'on',
            triggerText: cells[4] ?? '',
            instruction: cells[cells.length - 1] ?? cells[2] ?? '',
            duration: cells[5] ? Number.parseInt(cells[5], 10) : undefined,
          });
        }
      }
    }

    return cues;
  }

  private async readPackageComponent(
    showPackageId: string,
    filename: string,
  ): Promise<string | null> {
    const filePath = path.join(
      getConfig().dataDir,
      'show-packages',
      showPackageId,
      filename,
    );
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private inferCueType(text: string): Cue['type'] {
    const lower = text.toLowerCase();
    if (lower.includes('light')) return 'lights';
    if (lower.includes('sound') || lower.includes('sfx')) return 'sound';
    if (lower.includes('music') || lower.includes('underscore')) return 'music';
    if (lower.includes('prop')) return 'props';
    if (lower.includes('actor') || lower.includes('enter') || lower.includes('exit')) return 'actor';
    return 'note';
  }
}

export const livePerformanceMode = new LivePerformanceMode();

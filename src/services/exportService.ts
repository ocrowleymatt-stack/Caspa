/**
 * Caspa Export Service — gate, layout HTML, PDF and markdown export
 */

import type { CommissionState } from '../types/commission';
import type {
  ExportContext,
  ExportGateResult,
  ExportProfile,
  ContentAnalysisSummary,
} from '../types/export';
import type { StoryPromise } from '../types/promise';
import type { Diagnosis } from '../types/commission';
import { loadPromises } from './promiseRegistryService';
import { getProjectKey } from './researchLibraryService';
import type { ProjectBriefLike } from './commissionService';

const COMMISSION_KEY = 'caspa.commission';

export function loadExportContext(brief: ProjectBriefLike, authorEmail = ''): ExportContext {
  let manuscript = localStorage.getItem('caspa.whitePage') || localStorage.getItem('caspa.manuscriptSource') || '';

  let diagnosis: Diagnosis | null = null;
  let promises: StoryPromise[] = loadPromises(getProjectKey(brief));

  try {
    const raw = localStorage.getItem(COMMISSION_KEY);
    if (raw) {
      const state = JSON.parse(raw) as Partial<CommissionState>;
      if (state.artefact?.trim()) manuscript = state.artefact;
      if (state.diagnosis) diagnosis = state.diagnosis;
      if (state.promises?.length) promises = state.promises;
    }
  } catch {
    /* use defaults */
  }

  return {
    title: brief.title,
    author: authorEmail,
    manuscript,
    promises,
    diagnosis,
    audience: brief.audience,
    tone: brief.tone,
  };
}

export function evaluateExportGate(
  ctx: ExportContext,
  overrideBrokenPromises = false
): ExportGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const wordCount = ctx.manuscript.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount < 100) {
    blockers.push('Manuscript is too short or empty. Complete a Workshop commission first.');
  }

  const broken = ctx.promises.filter((p) => p.status === 'broken');
  if (broken.length > 0 && !overrideBrokenPromises) {
    blockers.push(
      `${broken.length} broken story promise${broken.length > 1 ? 's' : ''} — resolve in Workshop → Promises, or override below.`
    );
  }

  const highRisk = ctx.promises.filter(
    (p) => p.riskScore >= 75 && !['paid_off', 'cut_advised'].includes(p.status)
  );
  if (highRisk.length > 0) {
    warnings.push(`${highRisk.length} high-risk open promise(s) may disappoint readers.`);
  }

  if (ctx.diagnosis?.viabilityScore != null && ctx.diagnosis.viabilityScore < 45) {
    warnings.push(`Viability score is ${ctx.diagnosis.viabilityScore}% — consider another Workshop pass.`);
  }

  if (ctx.diagnosis?.suggestRebuild) {
    warnings.push('Caspa previously recommended a full restructure.');
  }

  return {
    canExport: blockers.length === 0,
    blocked: blockers.length > 0,
    blockers,
    warnings,
    wordCount,
  };
}

export function parseManuscriptSections(text: string): { title: string; content: string }[] {
  const byHash = text.split(/\n(?=# )/);
  if (byHash.length > 1) {
    return byHash.map((block) => {
      const lines = block.trim().split('\n');
      const title = lines[0]?.replace(/^#\s*/, '') || 'Section';
      return { title, content: lines.slice(1).join('\n').trim() };
    });
  }

  const byRule = text.split(/\n---\n/);
  if (byRule.length > 1) {
    return byRule.map((block, i) => {
      const trimmed = block.trim();
      const firstLine = trimmed.split('\n')[0] || '';
      const isTitle = firstLine.startsWith('#');
      return {
        title: isTitle ? firstLine.replace(/^#\s*/, '') : `Section ${i + 1}`,
        content: isTitle ? trimmed.split('\n').slice(1).join('\n').trim() : trimmed,
      };
    });
  }

  return [{ title: 'Manuscript', content: text.trim() }];
}

function profileStyles(profile: ExportProfile): string {
  const base = `
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; line-height: 1.65; margin: 0; padding: 0; }
    h1 { font-size: 2em; margin: 0 0 0.5em; page-break-after: avoid; }
    h2 { font-size: 1.35em; margin: 2em 0 0.75em; page-break-after: avoid; }
    p { margin: 0 0 1em; text-align: justify; }
    .meta { color: #555; font-size: 0.9em; margin-bottom: 2em; }
    .chapter { page-break-before: always; }
    .chapter:first-of-type { page-break-before: auto; }
  `;

  if (profile === 'course-book') {
    return (
      base +
      `
    body { font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 210mm; }
    .callout { background: #f0f7ff; border-left: 4px solid #2563eb; padding: 1em 1.25em; margin: 1.5em 0; }
    .module-label { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.75em; color: #2563eb; font-weight: 700; }
    `
    );
  }

  if (profile === 'subject-bible') {
    return (
      base +
      `
    body { font-family: 'Palatino Linotype', Palatino, serif; font-size: 10.5pt; max-width: 210mm; }
    h2 { border-bottom: 1px solid #ccc; padding-bottom: 0.25em; }
    .ref-note { font-size: 0.85em; color: #444; font-style: italic; }
    `
    );
  }

  return base;
}

export function buildPrintHtml(ctx: ExportContext, profile: ExportProfile): string {
  const sections = parseManuscriptSections(ctx.manuscript);
  const styles = profileStyles(profile);

  const titlePage = `
    <div class="title-page" style="min-height: 80vh; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always;">
      <h1 style="font-size: 2.5em;">${escapeHtml(ctx.title)}</h1>
      ${ctx.author ? `<p class="meta">${escapeHtml(ctx.author)}</p>` : ''}
      <p class="meta">${escapeHtml(ctx.tone)}</p>
    </div>
  `;

  const body = sections
    .map((sec, i) => {
      const paras = sec.content
        .split(/\n\n+/)
        .filter(Boolean)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
        .join('');

      if (profile === 'course-book') {
        return `
          <section class="chapter">
            <div class="module-label">Module ${i + 1}</div>
            <h2>${escapeHtml(sec.title)}</h2>
            ${paras}
            <div class="callout"><strong>Key takeaway:</strong> Review and apply the concepts in this module before continuing.</div>
          </section>`;
      }

      if (profile === 'subject-bible') {
        return `
          <section class="chapter">
            <h2>${escapeHtml(sec.title)}</h2>
            <p class="ref-note">Reference entry · ${escapeHtml(ctx.title)}</p>
            ${paras}
          </section>`;
      }

      return `
        <section class="chapter">
          <h2>${escapeHtml(sec.title)}</h2>
          ${paras}
        </section>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${styles}</style></head><body>${titlePage}${body}</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function analyzeForExport(ctx: ExportContext): Promise<ContentAnalysisSummary> {
  try {
    const response = await fetch('/api/content/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: ctx.manuscript.slice(0, 50000),
        title: ctx.title,
        targetAudience: ctx.audience,
        purpose: 'publishing',
        context: ctx.tone,
      }),
    });

    if (!response.ok) return {};

    const data = await response.json();
    return {
      documentType: data.intelligence?.documentType?.type,
      estimatedPages: data.intelligence?.documentType?.estimatedPages,
      readiness: data.intelligence?.qualityScore?.readiness,
      blockers: data.validation?.blockers,
      suggestions: data.validation?.suggestions,
      illustrationCount: data.intelligence?.illustrations?.length,
    };
  } catch {
    return {};
  }
}

export function downloadMarkdown(ctx: ExportContext): void {
  const blob = new Blob([ctx.manuscript], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${slugify(ctx.title)}.md`);
}

export async function downloadPdf(ctx: ExportContext, profile: ExportProfile): Promise<void> {
  const html = buildPrintHtml(ctx, profile === 'professional-print' ? 'kdp-novel' : profile);
  const slug = slugify(ctx.title);
  const filename = `${slug}_${profile}.pdf`;

  const useServer = profile === 'professional-print' || profile === 'kdp-novel' || profile === 'course-book' || profile === 'subject-bible';

  if (useServer) {
    try {
      const response = await fetch('/api/caspa/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, profile, filename }),
      });

      if (response.ok) {
        const blob = await response.blob();
        triggerDownload(blob, filename);
        return;
      }
    } catch {
      /* fall through to client PDF */
    }
  }

  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  const { default: html2pdf } = await import('html2pdf.js');

  const format =
    profile === 'kdp-novel' ? [6, 9] as [number, number] : profile === 'course-book' || profile === 'subject-bible' ? 'a4' : 'letter';

  const margin = profile === 'kdp-novel' ? [0.75, 0.6, 0.75, 0.6] : [0.75, 0.75, 0.75, 0.75];

  try {
    await html2pdf()
      .set({
        margin,
        filename: `${slugify(ctx.title)}_${profile}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'in', format, orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}

function slugify(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'caspa-export'
  );
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Cover design engine — novels, illustrated books, children's picture books.
 * Wraparound jackets, square trims, spine calc, typography overlays, character lock.
 */

import {
  type AgeBand,
  type ArtStyle,
  type CharacterLock,
  type TrimSpec,
  getArtStyle,
  getTrim,
  type TrimId,
} from './pictureBookEngine';

export type CoverFormat = 'front-only' | 'wraparound' | 'board-book' | 'dust-jacket';

export interface CoverDesignRequest {
  title: string;
  subtitle?: string;
  author: string;
  ageBand?: AgeBand;
  trimId?: TrimId;
  artStyle?: ArtStyle;
  format?: CoverFormat;
  pageCount?: number;
  paperThicknessIn?: number;
  palette?: string[];
  blurb?: string;
  characterLocks?: CharacterLock[];
  mood?: string;
  existingPrompt?: string;
}

export interface CoverTypography {
  titleFont: string;
  authorFont: string;
  titleSizePt: number;
  authorSizePt: number;
  titleColor: string;
  authorColor: string;
  titleAlign: 'left' | 'center' | 'right';
  titlePlacement: 'top' | 'center' | 'bottom';
  shadow: boolean;
}

export interface CoverDesignSpec {
  trim: TrimSpec;
  format: CoverFormat;
  spineWidthIn: number;
  fullWidthIn: number;
  fullHeightIn: number;
  bleedMm: number;
  safeMm: number;
  typography: CoverTypography;
  frontPrompt: string;
  wraparoundPrompt: string;
  backPrompt: string;
  palette: string[];
  barcodeSafeZone: { xPct: number; yPct: number; wPct: number; hPct: number };
  htmlPreview: string;
}

/** Amazon KDP cream/white ~0.0025"; colour ~0.002252" — use configurable. */
export function calculateSpineWidthIn(pageCount: number, paperThicknessIn = 0.0025): number {
  const pages = Math.max(24, pageCount);
  return Math.round(pages * paperThicknessIn * 1000) / 1000;
}

export function buildCoverTypography(ageBand: AgeBand = '3-5'): CoverTypography {
  if (ageBand === '0-3' || ageBand === '3-5' || ageBand === 'all-ages') {
    return {
      titleFont: '"Fredoka", "Nunito", "Avenir Next", system-ui, sans-serif',
      authorFont: '"Nunito", "Avenir Next", system-ui, sans-serif',
      titleSizePt: ageBand === '0-3' ? 48 : 36,
      authorSizePt: 16,
      titleColor: '#1a1520',
      authorColor: '#3d3428',
      titleAlign: 'center',
      titlePlacement: 'top',
      shadow: true,
    };
  }
  if (ageBand === '5-8' || ageBand === '8-12') {
    return {
      titleFont: '"Fraunces", "Iowan Old Style", Georgia, serif',
      authorFont: '"Source Sans 3", system-ui, sans-serif',
      titleSizePt: 32,
      authorSizePt: 14,
      titleColor: '#14101a',
      authorColor: '#3d3428',
      titleAlign: 'center',
      titlePlacement: 'bottom',
      shadow: true,
    };
  }
  return {
    titleFont: '"Cormorant Garamond", "Palatino Linotype", Georgia, serif',
    authorFont: '"Source Sans 3", system-ui, sans-serif',
    titleSizePt: 42,
    authorSizePt: 14,
    titleColor: '#f8f4ec',
    authorColor: '#e8dfd0',
    titleAlign: 'center',
    titlePlacement: 'bottom',
    shadow: true,
  };
}

export function buildCoverDesign(req: CoverDesignRequest): CoverDesignSpec {
  const ageBand = req.ageBand || '3-5';
  const trim = getTrim(req.trimId || (ageBand.startsWith('adult') ? '6x9' : '8x8'));
  const format = req.format || (ageBand === '0-3' ? 'board-book' : 'wraparound');
  const artStyle = req.artStyle || 'watercolor-picture-book';
  const style = getArtStyle(artStyle);
  const palette = req.palette?.length ? req.palette : ['#f7efe3', '#2f6f4e', '#d97706', '#1e293b'];
  const pageCount = req.pageCount || 32;
  const spineWidthIn = calculateSpineWidthIn(pageCount, req.paperThicknessIn);
  const fullWidthIn = format === 'front-only' ? trim.widthIn : trim.widthIn * 2 + spineWidthIn;
  const fullHeightIn = trim.heightIn;
  const typography = buildCoverTypography(ageBand);
  const locks = (req.characterLocks || []).map((l) => l.consistencyPrompt).join('\n');
  const mood = req.mood || 'warm, inviting, emotionally clear';

  const frontPrompt =
    req.existingPrompt?.trim() ||
    [
      `Professional book cover FRONT for "${req.title}"${req.subtitle ? `: ${req.subtitle}` : ''}.`,
      `Author credit space for ${req.author || 'Author'}.`,
      `${style.promptHint}. Mood: ${mood}. Age band: ${ageBand}.`,
      `Trim ${trim.label}. Composition suited to ${trim.orientation} format.`,
      'Hero visual, clear focal point, leave clean area for title typography overlay.',
      'NO text, NO letters, NO barcode, NO mockup frame in the artwork.',
      `Palette: ${palette.join(', ')}.`,
      locks,
    ].join('\n');

  const backPrompt = [
    `Book cover BACK panel continuing the world of "${req.title}".`,
    `${style.promptHint}. Quieter complementary scene for blurb space.`,
    'Leave a calm lower or central area for blurb text. No letters in art.',
    `Palette: ${palette.join(', ')}.`,
    locks,
  ].join('\n');

  const wraparoundPrompt = [
    `FULL WRAPAROUND book jacket (back | spine | front as one continuous image) for "${req.title}".`,
    `Total aspect roughly ${fullWidthIn.toFixed(2)} × ${fullHeightIn.toFixed(2)} inches.`,
    `Spine width ~${spineWidthIn.toFixed(3)}in in the centre strip.`,
    `${style.promptHint}. Mood: ${mood}. Age: ${ageBand}.`,
    'LEFT third = back cover scene. CENTRE thin strip = spine motif. RIGHT third = front hero moment.',
    'Continuous lighting and colour. Leave clean zones for title (front), author, and back blurb.',
    'NO text glyphs, NO barcode art, NO 3D book mockup.',
    `Palette: ${palette.join(', ')}.`,
    locks,
  ].join('\n');

  const htmlPreview = buildCoverPreviewHtml({
    title: req.title,
    subtitle: req.subtitle || '',
    author: req.author || '',
    blurb: req.blurb || '',
    trim,
    spineWidthIn,
    format,
    typography,
    palette,
    imageUrl: '',
  });

  return {
    trim,
    format,
    spineWidthIn,
    fullWidthIn,
    fullHeightIn,
    bleedMm: 3.5,
    safeMm: 6,
    typography,
    frontPrompt,
    wraparoundPrompt,
    backPrompt,
    palette,
    barcodeSafeZone: { xPct: 8, yPct: 78, wPct: 28, hPct: 14 },
    htmlPreview,
  };
}

export function buildCoverPreviewHtml(opts: {
  title: string;
  subtitle: string;
  author: string;
  blurb: string;
  trim: TrimSpec;
  spineWidthIn: number;
  format: CoverFormat;
  typography: CoverTypography;
  palette: string[];
  imageUrl: string;
  wrapImageUrl?: string;
}): string {
  const frontW = opts.trim.widthIn;
  const h = opts.trim.heightIn;
  const spine = opts.spineWidthIn;
  const showWrap = opts.format !== 'front-only';
  const totalW = showWrap ? frontW * 2 + spine : frontW;
  const ty = opts.typography;
  const titleTop =
    ty.titlePlacement === 'top' ? '8%' : ty.titlePlacement === 'center' ? '38%' : 'auto';
  const titleBottom = ty.titlePlacement === 'bottom' ? '12%' : 'auto';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
  body{margin:0;background:#d9d0c2;display:grid;place-items:center;min-height:100vh;font-family:${ty.titleFont};}
  .jacket{display:flex;width:${totalW}in;height:${h}in;box-shadow:0 18px 50px rgba(0,0,0,.28);background:${opts.palette[0] || '#f7efe3'};}
  .panel{position:relative;overflow:hidden;background-size:cover;background-position:center;}
  .back{width:${frontW}in;background-image:url('${opts.wrapImageUrl || opts.imageUrl}');}
  .spine{width:${spine}in;background:${opts.palette[3] || '#1e293b'};color:#f8f4ec;display:flex;align-items:center;justify-content:center;}
  .spine span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10pt;letter-spacing:.08em;}
  .front{width:${frontW}in;background-image:url('${opts.imageUrl}');}
  .title{position:absolute;left:8%;right:8%;top:${titleTop};bottom:${titleBottom};text-align:${ty.titleAlign};color:${ty.titleColor};
    font-size:${ty.titleSizePt}pt;font-weight:800;line-height:1.05;${ty.shadow ? 'text-shadow:0 2px 8px rgba(0,0,0,.35);' : ''}}
  .author{position:absolute;left:8%;right:8%;bottom:6%;text-align:${ty.titleAlign};color:${ty.authorColor};font-family:${ty.authorFont};font-size:${ty.authorSizePt}pt;}
  .blurb{position:absolute;left:10%;right:10%;top:18%;font-size:9pt;line-height:1.45;color:#1a1520;background:rgba(255,250,242,.72);padding:10px;border-radius:8px;}
  .barcode{position:absolute;left:8%;bottom:6%;width:28%;height:12%;border:1px dashed rgba(0,0,0,.25);display:grid;place-items:center;font-size:8pt;color:#666;background:rgba(255,255,255,.65);}
  </style></head><body><div class="jacket">
  ${
    showWrap
      ? `<div class="panel back">${opts.blurb ? `<div class="blurb">${escape(opts.blurb)}</div>` : ''}<div class="barcode">ISBN</div></div>
         <div class="panel spine"><span>${escape(opts.title)}</span></div>`
      : ''
  }
  <div class="panel front">
    <div class="title">${escape(opts.title)}${opts.subtitle ? `<div style="font-size:40%;opacity:.85;margin-top:8px;font-weight:600">${escape(opts.subtitle)}</div>` : ''}</div>
    <div class="author">${escape(opts.author)}</div>
  </div>
  </div></body></html>`;
}

function escape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

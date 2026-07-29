/**
 * Picture-book & illustrated layout engine.
 * Age bands, page budgets, spreads, text-safe zones, character lock.
 */

export type AgeBand = '0-3' | '3-5' | '5-8' | '8-12' | 'all-ages' | 'adult-illustrated';

export type TrimId =
  | '8x8'
  | '8.5x8.5'
  | '10x8'
  | '8x10'
  | '9x7'
  | '6x9'
  | '5.5x8.5'
  | 'A4';

export type SpreadLayout =
  | 'full-bleed-art'
  | 'art-left-text-right'
  | 'text-left-art-right'
  | 'art-top-text-bottom'
  | 'text-top-art-bottom'
  | 'vignette-center'
  | 'spot-art-margin'
  | 'panel-comic'
  | 'wraparound-spread';

export type ArtStyle =
  | 'watercolor-picture-book'
  | 'gouache-storybook'
  | 'soft-pastel'
  | 'ink-and-wash'
  | 'digital-cel'
  | 'collage-paper'
  | 'classic-line'
  | 'painterly-literary'
  | 'noir-illustrated'
  | 'blueprint-technical';

export interface TrimSpec {
  id: TrimId;
  label: string;
  widthIn: number;
  heightIn: number;
  orientation: 'square' | 'landscape' | 'portrait';
  bestFor: string[];
}

export interface AgeBandProfile {
  id: AgeBand;
  label: string;
  wordsPerPage: [number, number];
  maxWordsTotal: number;
  typicalPages: number[];
  fontSizePt: number;
  lineHeight: number;
  readingLevel: string;
  textPlacement: 'large-safe' | 'moderate' | 'dense-ok';
  notes: string;
}

export interface TextZone {
  /** Percent of page box: x,y,w,h from top-left of single page */
  x: number;
  y: number;
  w: number;
  h: number;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  contrast: 'light-on-dark' | 'dark-on-light' | 'auto';
}

export interface CharacterLock {
  name: string;
  ageLook?: string;
  speciesOrType?: string;
  signatureFeatures: string[];
  palette: string[];
  outfit?: string;
  consistencyPrompt: string;
}

export interface SpreadPage {
  pageNumber: number;
  side: 'left' | 'right' | 'single';
  layout: SpreadLayout;
  text: string;
  textZone: TextZone;
  illustrationBrief: string;
  illustrationPrompt: string;
  imageUrl?: string;
  wordCount: number;
}

export interface PictureBookPlan {
  title: string;
  ageBand: AgeBand;
  trim: TrimSpec;
  pageCount: number;
  artStyle: ArtStyle;
  palette: string[];
  characterLocks: CharacterLock[];
  pages: SpreadPage[];
  coverPrompt: string;
  wraparoundCoverPrompt: string;
  bleedMm: number;
  safetyMm: number;
  createdAt: string;
}

export const TRIM_SPECS: TrimSpec[] = [
  { id: '8x8', label: '8×8″ square', widthIn: 8, heightIn: 8, orientation: 'square', bestFor: ['picture book', 'board book'] },
  { id: '8.5x8.5', label: '8.5×8.5″ square', widthIn: 8.5, heightIn: 8.5, orientation: 'square', bestFor: ['picture book'] },
  { id: '10x8', label: '10×8″ landscape', widthIn: 10, heightIn: 8, orientation: 'landscape', bestFor: ['picture book', 'illustrated'] },
  { id: '8x10', label: '8×10″ portrait', widthIn: 8, heightIn: 10, orientation: 'portrait', bestFor: ['illustrated kids', 'chapter illustrated'] },
  { id: '9x7', label: '9×7″ landscape', widthIn: 9, heightIn: 7, orientation: 'landscape', bestFor: ['picture book'] },
  { id: '6x9', label: '6×9″ novel', widthIn: 6, heightIn: 9, orientation: 'portrait', bestFor: ['illustrated novel', 'trade'] },
  { id: '5.5x8.5', label: '5.5×8.5″', widthIn: 5.5, heightIn: 8.5, orientation: 'portrait', bestFor: ['early chapter'] },
  { id: 'A4', label: 'A4', widthIn: 8.27, heightIn: 11.69, orientation: 'portrait', bestFor: ['activity', 'course illustrated'] },
];

export const AGE_BANDS: AgeBandProfile[] = [
  {
    id: '0-3',
    label: '0–3 board / toddler',
    wordsPerPage: [0, 15],
    maxWordsTotal: 150,
    typicalPages: [12, 16, 20],
    fontSizePt: 22,
    lineHeight: 1.35,
    readingLevel: 'read-aloud',
    textPlacement: 'large-safe',
    notes: 'Huge type, few words, full-bleed art, high contrast.',
  },
  {
    id: '3-5',
    label: '3–5 preschool',
    wordsPerPage: [10, 40],
    maxWordsTotal: 500,
    typicalPages: [24, 32],
    fontSizePt: 18,
    lineHeight: 1.4,
    readingLevel: 'read-aloud / emerging',
    textPlacement: 'large-safe',
    notes: 'Classic picture-book density. Clear safe text zones.',
  },
  {
    id: '5-8',
    label: '5–8 early reader',
    wordsPerPage: [30, 80],
    maxWordsTotal: 1200,
    typicalPages: [32, 40],
    fontSizePt: 16,
    lineHeight: 1.45,
    readingLevel: 'early independent',
    textPlacement: 'moderate',
    notes: 'More story per page; still image-led.',
  },
  {
    id: '8-12',
    label: '8–12 illustrated chapter',
    wordsPerPage: [80, 250],
    maxWordsTotal: 15000,
    typicalPages: [48, 64, 96],
    fontSizePt: 13,
    lineHeight: 1.5,
    readingLevel: 'middle grade',
    textPlacement: 'dense-ok',
    notes: 'Spot art, chapter openers, occasional full spreads.',
  },
  {
    id: 'all-ages',
    label: 'All-ages picture book',
    wordsPerPage: [20, 60],
    maxWordsTotal: 800,
    typicalPages: [32, 40],
    fontSizePt: 17,
    lineHeight: 1.42,
    readingLevel: 'layered',
    textPlacement: 'moderate',
    notes: 'Works for kids and adults; subtext in images.',
  },
  {
    id: 'adult-illustrated',
    label: 'Adult illustrated / graphic narrative',
    wordsPerPage: [100, 400],
    maxWordsTotal: 40000,
    typicalPages: [64, 128, 200],
    fontSizePt: 11,
    lineHeight: 1.5,
    readingLevel: 'adult',
    textPlacement: 'dense-ok',
    notes: 'Literary illustrated, graphic essays, art books.',
  },
];

export const ART_STYLES: Array<{ id: ArtStyle; label: string; promptHint: string }> = [
  { id: 'watercolor-picture-book', label: 'Watercolour picture book', promptHint: 'soft watercolour, gentle washes, storybook charm, print-ready' },
  { id: 'gouache-storybook', label: 'Gouache storybook', promptHint: 'opaque gouache, rich flat colour, classic mid-century storybook' },
  { id: 'soft-pastel', label: 'Soft pastel', promptHint: 'soft pastel textures, dreamy edges, toddler-friendly warmth' },
  { id: 'ink-and-wash', label: 'Ink & wash', promptHint: 'expressive ink line with watercolour wash, literary kids' },
  { id: 'digital-cel', label: 'Digital cel', promptHint: 'clean digital illustration, bold shapes, contemporary picture book' },
  { id: 'collage-paper', label: 'Paper collage', promptHint: 'cut-paper collage, tactile layers, playful composition' },
  { id: 'classic-line', label: 'Classic line', promptHint: 'elegant classic line art with limited colour washes' },
  { id: 'painterly-literary', label: 'Painterly literary', promptHint: 'painterly literary illustration, atmospheric, museum quality' },
  { id: 'noir-illustrated', label: 'Noir illustrated', promptHint: 'high-contrast noir illustration, dramatic lighting' },
  { id: 'blueprint-technical', label: 'Blueprint / technical', promptHint: 'precise blueprint technical illustration, educational clarity' },
];

const LAYOUT_ZONES: Record<SpreadLayout, TextZone> = {
  'full-bleed-art': { x: 8, y: 72, w: 84, h: 22, align: 'center', verticalAlign: 'bottom', contrast: 'auto' },
  'art-left-text-right': { x: 54, y: 18, w: 40, h: 64, align: 'left', verticalAlign: 'middle', contrast: 'dark-on-light' },
  'text-left-art-right': { x: 6, y: 18, w: 40, h: 64, align: 'left', verticalAlign: 'middle', contrast: 'dark-on-light' },
  'art-top-text-bottom': { x: 8, y: 68, w: 84, h: 26, align: 'center', verticalAlign: 'top', contrast: 'dark-on-light' },
  'text-top-art-bottom': { x: 8, y: 6, w: 84, h: 26, align: 'center', verticalAlign: 'top', contrast: 'dark-on-light' },
  'vignette-center': { x: 12, y: 78, w: 76, h: 16, align: 'center', verticalAlign: 'bottom', contrast: 'auto' },
  'spot-art-margin': { x: 8, y: 12, w: 58, h: 76, align: 'left', verticalAlign: 'top', contrast: 'dark-on-light' },
  'panel-comic': { x: 6, y: 70, w: 88, h: 24, align: 'left', verticalAlign: 'top', contrast: 'dark-on-light' },
  'wraparound-spread': { x: 10, y: 70, w: 80, h: 22, align: 'center', verticalAlign: 'bottom', contrast: 'auto' },
};

export function getTrim(id: TrimId): TrimSpec {
  return TRIM_SPECS.find((t) => t.id === id) || TRIM_SPECS[0];
}

export function getAgeBand(id: AgeBand): AgeBandProfile {
  return AGE_BANDS.find((a) => a.id === id) || AGE_BANDS[1];
}

export function getArtStyle(id: ArtStyle) {
  return ART_STYLES.find((s) => s.id === id) || ART_STYLES[0];
}

export function recommendPageCount(age: AgeBand, wordCount: number): number {
  const band = getAgeBand(age);
  const byWords = Math.max(band.typicalPages[0], Math.ceil(wordCount / Math.max(1, band.wordsPerPage[1])));
  const preferred = band.typicalPages.find((p) => p >= byWords) || band.typicalPages[band.typicalPages.length - 1];
  // Picture books often print in multiples of 4 (signatures)
  return Math.ceil(preferred / 4) * 4;
}

export function chunkTextForPages(text: string, pageCount: number, age: AgeBand): string[] {
  const clean = text.replace(/\r/g, '').trim();
  if (!clean) return Array.from({ length: pageCount }, () => '');

  const paras = clean.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const band = getAgeBand(age);
  const target = Math.max(band.wordsPerPage[0], Math.floor(band.wordsPerPage[1] * 0.75));

  const pages: string[] = [];
  let bucket: string[] = [];
  let words = 0;

  const flush = () => {
    if (bucket.length) {
      pages.push(bucket.join('\n\n'));
      bucket = [];
      words = 0;
    }
  };

  for (const para of paras) {
    const w = para.split(/\s+/).filter(Boolean).length;
    if (pages.length >= pageCount - 1) {
      bucket.push(para);
      words += w;
      continue;
    }
    if (words + w > target && bucket.length) {
      flush();
    }
    bucket.push(para);
    words += w;
  }
  flush();

  while (pages.length < pageCount) pages.push('');
  return pages.slice(0, pageCount);
}

export function pickLayoutForPage(index: number, age: AgeBand, hasText: boolean): SpreadLayout {
  if (!hasText) return 'full-bleed-art';
  if (age === '0-3') return index % 2 === 0 ? 'full-bleed-art' : 'art-top-text-bottom';
  if (age === '3-5' || age === 'all-ages') {
    const cycle: SpreadLayout[] = ['art-left-text-right', 'full-bleed-art', 'text-left-art-right', 'art-top-text-bottom', 'wraparound-spread'];
    return cycle[index % cycle.length];
  }
  if (age === '5-8') {
    const cycle: SpreadLayout[] = ['art-top-text-bottom', 'text-left-art-right', 'vignette-center', 'full-bleed-art'];
    return cycle[index % cycle.length];
  }
  if (age === '8-12') return index % 4 === 0 ? 'full-bleed-art' : 'spot-art-margin';
  return index % 3 === 0 ? 'full-bleed-art' : 'spot-art-margin';
}

export function buildCharacterLock(input: {
  name: string;
  ageLook?: string;
  speciesOrType?: string;
  signatureFeatures?: string[];
  palette?: string[];
  outfit?: string;
}): CharacterLock {
  const features = input.signatureFeatures?.length
    ? input.signatureFeatures
    : ['consistent face proportions', 'same eye colour', 'recognisable silhouette'];
  const palette = input.palette?.length ? input.palette : ['#f4e4c1', '#2b6cb0', '#c05621'];
  const consistencyPrompt = [
    `CHARACTER LOCK — always depict "${input.name}" consistently across every page.`,
    input.ageLook ? `Age look: ${input.ageLook}.` : '',
    input.speciesOrType ? `Type: ${input.speciesOrType}.` : '',
    `Signature features: ${features.join('; ')}.`,
    input.outfit ? `Outfit: ${input.outfit}.` : '',
    `Palette accents: ${palette.join(', ')}.`,
    'Same character, same design language, same proportions. No redesign between pages.',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    name: input.name,
    ageLook: input.ageLook,
    speciesOrType: input.speciesOrType,
    signatureFeatures: features,
    palette,
    outfit: input.outfit,
    consistencyPrompt,
  };
}

export function buildPageIllustrationPrompt(opts: {
  title: string;
  page: SpreadPage;
  artStyle: ArtStyle;
  palette: string[];
  locks: CharacterLock[];
  ageBand: AgeBand;
}): string {
  const style = getArtStyle(opts.artStyle);
  const locks = opts.locks.map((l) => l.consistencyPrompt).join('\n');
  return [
    `Children's / illustrated book interior art for "${opts.title}".`,
    `Age band: ${opts.ageBand}. Style: ${style.promptHint}.`,
    `Page ${opts.page.pageNumber} (${opts.page.side}). Layout: ${opts.page.layout}.`,
    `Scene brief: ${opts.page.illustrationBrief}`,
    `Text on page (do NOT render letters in the image unless layout is full-bleed with empty safe zone): "${opts.page.text.slice(0, 280)}"`,
    `Leave a clean text-safe region roughly at ${opts.page.textZone.x}%,${opts.page.textZone.y}% size ${opts.page.textZone.w}x${opts.page.textZone.h}% — soft uncluttered area for overlay type.`,
    `Palette: ${opts.palette.join(', ')}.`,
    'Print-ready, high detail, full-bleed friendly, no watermarks, no UI chrome, no fake book mockup frames.',
    locks,
  ]
    .filter(Boolean)
    .join('\n');
}

export function planPictureBook(opts: {
  title: string;
  manuscript: string;
  ageBand?: AgeBand;
  trimId?: TrimId;
  artStyle?: ArtStyle;
  pageCount?: number;
  palette?: string[];
  characters?: Array<{ name: string; ageLook?: string; speciesOrType?: string; features?: string[]; outfit?: string }>;
}): PictureBookPlan {
  const ageBand = opts.ageBand || '3-5';
  const band = getAgeBand(ageBand);
  const words = opts.manuscript.trim().split(/\s+/).filter(Boolean).length;
  const pageCount = opts.pageCount || recommendPageCount(ageBand, words);
  const trim = getTrim(opts.trimId || (ageBand === 'adult-illustrated' ? '6x9' : '8x8'));
  const artStyle = opts.artStyle || 'watercolor-picture-book';
  const palette = opts.palette?.length ? opts.palette : ['#f7efe3', '#2f6f4e', '#d97706', '#1e293b'];
  const locks = (opts.characters || []).map((c) =>
    buildCharacterLock({
      name: c.name,
      ageLook: c.ageLook,
      speciesOrType: c.speciesOrType,
      signatureFeatures: c.features,
      outfit: c.outfit,
      palette,
    })
  );

  const chunks = chunkTextForPages(opts.manuscript, pageCount, ageBand);
  const pages: SpreadPage[] = chunks.map((text, i) => {
    const layout = pickLayoutForPage(i, ageBand, Boolean(text.trim()));
    const page: SpreadPage = {
      pageNumber: i + 1,
      side: i % 2 === 0 ? 'right' : 'left',
      layout,
      text,
      textZone: LAYOUT_ZONES[layout],
      illustrationBrief: text.trim()
        ? `Visualise the emotional beat of: ${text.slice(0, 160)}`
        : `Wordless atmospheric beat continuing the story after page ${i}.`,
      illustrationPrompt: '',
      wordCount: text.trim().split(/\s+/).filter(Boolean).length,
    };
    page.illustrationPrompt = buildPageIllustrationPrompt({
      title: opts.title,
      page,
      artStyle,
      palette,
      locks,
      ageBand,
    });
    return page;
  });

  const style = getArtStyle(artStyle);
  const coverPrompt = [
    `Picture-book front cover for "${opts.title}".`,
    `${style.promptHint}. Age band ${ageBand}.`,
    'Hero character centred, inviting, high emotional clarity, room at top or bottom for title typography overlay.',
    `Palette: ${palette.join(', ')}.`,
    'No text in image. No barcode. Print-ready square-friendly composition unless trim is portrait/landscape.',
    locks.map((l) => l.consistencyPrompt).join(' '),
  ].join('\n');

  const wraparoundCoverPrompt = [
    `Wraparound picture-book cover (front + spine + back continuous scene) for "${opts.title}".`,
    `${style.promptHint}. Continuous narrative landscape across the full jacket.`,
    'Front (right third): hero moment. Spine (centre strip): calm motif. Back (left): quieter continuation.',
    'Leave clean areas for title (front), author (front/spine), and back-cover blurb.',
    `Palette: ${palette.join(', ')}. No text glyphs in artwork.`,
    locks.map((l) => l.consistencyPrompt).join(' '),
  ].join('\n');

  return {
    title: opts.title,
    ageBand,
    trim,
    pageCount,
    artStyle,
    palette,
    characterLocks: locks,
    pages,
    coverPrompt,
    wraparoundCoverPrompt,
    bleedMm: 3.5,
    safetyMm: ageBand === '0-3' ? 8 : 6,
    createdAt: new Date().toISOString(),
  };
}

/** HTML for a single page or facing spread preview / PDF. */
export function composeSpreadHtml(opts: {
  pages: SpreadPage[];
  trim: TrimSpec;
  age: AgeBandProfile;
  title: string;
  facing?: boolean;
}): string {
  const { pages, trim, age, title, facing = true } = opts;
  const pageW = trim.widthIn;
  const pageH = trim.heightIn;

  const renderPage = (p: SpreadPage) => {
    const zone = p.textZone;
    const textColor = zone.contrast === 'light-on-dark' ? '#fffaf2' : '#1a1520';
    const textShadow =
      zone.contrast === 'auto' || zone.contrast === 'light-on-dark'
        ? '0 1px 2px rgba(0,0,0,.55), 0 0 12px rgba(0,0,0,.25)'
        : 'none';
    return `
      <article class="page" style="width:${pageW}in;height:${pageH}in;">
        <div class="art" style="background-image:url('${p.imageUrl || ''}');"></div>
        ${
          p.text.trim()
            ? `<div class="text-zone" style="left:${zone.x}%;top:${zone.y}%;width:${zone.w}%;height:${zone.h}%;text-align:${zone.align};color:${textColor};text-shadow:${textShadow};font-size:${age.fontSizePt}pt;line-height:${age.lineHeight};">
                <div class="text-inner">${escapeHtml(p.text).replace(/\n/g, '<br/>')}</div>
              </div>`
            : ''
        }
        <div class="folio">${p.pageNumber}</div>
      </article>`;
  };

  const body = facing
    ? chunkPairs(pages)
        .map(
          (pair) =>
            `<section class="spread">${pair.map(renderPage).join('')}</section>`
        )
        .join('\n')
    : pages.map(renderPage).join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  @page { size: ${facing ? pageW * 2 : pageW}in ${pageH}in; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; background: #e8e0d4; }
  .spread { display: flex; width: ${pageW * 2}in; height: ${pageH}in; page-break-after: always; background: #fff; }
  .page { position: relative; overflow: hidden; background: #f7f1e6; flex: none; }
  .art { position: absolute; inset: 0; background-size: cover; background-position: center; background-color: #ddd5c6; }
  .text-zone { position: absolute; display: flex; align-items: center; padding: 0.2in; }
  .text-inner { width: 100%; }
  .folio { position: absolute; bottom: 0.18in; width: 100%; text-align: center; font-size: 9pt; color: #6b6256; z-index: 2; }
</style></head><body>
${body}
</body></html>`;
}

function chunkPairs<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

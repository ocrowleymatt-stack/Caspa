export function isPlanOrOutlineText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const head = trimmed.slice(0, 4000).toLowerCase();
  if (
    /book plan|outline|table of contents|beat sheet|chapter breakdown|scene breakdown|story plan|scene list|chapter list|act structure|three-act/i.test(head)
  ) {
    return true;
  }

  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 4) return false;

  const structured = lines.filter((line) =>
    /^[#*\-\d.]/.test(line)
    || /^chapter\s+\d/i.test(line)
    || /^act\s+[ivx\d]+/i.test(line)
    || /^part\s+[ivx\d]+/i.test(line),
  ).length;

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  if (structured / lines.length >= 0.4 && words < 6000) return true;

  const avgLineWords = words / lines.length;
  return structured >= 6 && avgLineWords < 18;
}

export function isSourceMaterialChapter(chapter: {
  title?: string;
  sourceRole?: string;
  unitStatus?: string;
  status?: string;
  content?: string;
}): boolean {
  if (chapter.sourceRole === 'original' || chapter.unitStatus === 'source') return true;
  if (chapter.status === 'outline') return true;

  const title = (chapter.title ?? '').toLowerCase();
  if (
    title.includes('source manuscript')
    || title.includes('uploaded manuscript')
    || title.startsWith('source white page')
    || title.startsWith('book plan')
    || title.includes('book plan')
  ) {
    return true;
  }

  return Boolean(chapter.content?.trim() && isPlanOrOutlineText(chapter.content));
}

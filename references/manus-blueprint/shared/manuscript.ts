export type ManuscriptChapter = {
  index: number;
  title: string;
  content: string;
  start: number;
  end: number;
  wordCount: number;
};

export function countWords(content: string): number {
  return content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
}

export function deriveProjectTitle(premise: string, formatLabel: string): string {
  const clean = premise.replace(/\s+/g, " ").trim();
  if (!clean) return `Untitled ${formatLabel}`;
  const words = clean.split(" ").slice(0, 7).join(" ");
  return words.length > 60 ? `${words.slice(0, 57)}…` : words.replace(/[.,;:!?]+$/, "");
}

export function splitManuscript(content: string): ManuscriptChapter[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const heading = /^(#{1,3}\s+.+|(?:chapter|part|section|act|scene)\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*[:.—-]\s*.*)?)$/gim;
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = heading.exec(normalized)) !== null) matches.push(match);

  if (!matches.length) {
    return [{ index: 0, title: "Manuscript", content: normalized, start: 0, end: normalized.length, wordCount: countWords(normalized) }];
  }

  const chapters: ManuscriptChapter[] = [];
  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? normalized.length;
    const rawTitle = String(match[0]).replace(/^#{1,3}\s+/, "").trim();
    const chapterContent = normalized.slice(start + match[0].length, end).trim();
    chapters.push({
      index,
      title: rawTitle || `Chapter ${index + 1}`,
      content: chapterContent,
      start,
      end,
      wordCount: countWords(chapterContent),
    });
  });

  return chapters;
}

export function manuscriptMetrics(content: string) {
  const chapters = splitManuscript(content);
  return {
    wordCount: countWords(content),
    chapterCount: chapters.length,
    chapters,
  };
}

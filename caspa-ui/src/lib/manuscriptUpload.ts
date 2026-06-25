export function stripBasicMarkup(text: string): string {
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\'[a-z0-9]+ ?/gi, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isSupportedManuscriptFile(file: File): boolean {
  return /\.(txt|md|markdown|rtf|html?)$/i.test(file.name) || file.type.startsWith('text/');
}

export async function readManuscriptFile(file: File): Promise<{ title: string; text: string }> {
  const raw = await file.text();
  const title = file.name.replace(/\.[^.]+$/, '') || 'Uploaded manuscript';
  return { title, text: stripBasicMarkup(raw) };
}

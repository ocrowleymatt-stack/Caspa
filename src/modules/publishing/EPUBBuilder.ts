import fs from 'fs/promises';
import path from 'path';
import { ZipArchive } from 'archiver';
import { createWriteStream } from 'fs';
import { finished } from 'stream/promises';
import {
  findById,
  getConfig,
  readCollection,
  type Chapter,
  type Project,
} from '../../shared';

export interface EPUBOptions {
  includeTableOfContents: boolean;
  coverImagePath?: string;
  styleSheet?: string;
  language: string;
  publisher?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function chapterXhtml(chapter: Chapter, index: number): string {
  const paragraphs = chapter.content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeXml(p)}</p>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="../styles/main.css"/>
</head>
<body>
  <section epub:type="chapter" id="chapter-${index + 1}">
    <h1>${escapeXml(chapter.title)}</h1>
    ${paragraphs}
  </section>
</body>
</html>`;
}

export class EPUBBuilder {
  private async getProjectChapters(projectId: string): Promise<Chapter[]> {
    const chapters = await readCollection<Chapter>('chapters');
    return chapters
      .filter((chapter) => chapter.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  }

  async buildEPUB(projectId: string, options: EPUBOptions): Promise<string> {
    const project = await findById<Project>('projects', projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const chapters = await this.getProjectChapters(projectId);
    const outputDir = path.join(getConfig().dataDir, 'exports', projectId);
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${projectId}-${Date.now()}.epub`);

    const stylesheet =
      options.styleSheet ??
      `body { font-family: Georgia, serif; line-height: 1.6; margin: 1em; }
h1 { page-break-before: always; }
p { margin: 0 0 1em; }`;

    const manifestItems = [
      '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
      '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
      '<item id="css" href="styles/main.css" media-type="text/css"/>',
    ];
    const spineItems = ['<itemref idref="nav"/>'];

    const navLinks = chapters
      .map(
        (chapter, index) =>
          `<li><a href="chapters/ch-${index + 1}.xhtml">${escapeXml(chapter.title)}</a></li>`,
      )
      .join('\n');

    const ncxPoints = chapters
      .map(
        (chapter, index) => `    <navPoint id="navPoint-${index + 1}" playOrder="${index + 1}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="chapters/ch-${index + 1}.xhtml"/>
    </navPoint>`,
      )
      .join('\n');

    chapters.forEach((chapter, index) => {
      manifestItems.push(
        `<item id="ch-${index + 1}" href="chapters/ch-${index + 1}.xhtml" media-type="application/xhtml+xml"/>`,
      );
      spineItems.push(`<itemref idref="ch-${index + 1}"/>`);
    });

    if (options.coverImagePath) {
      manifestItems.push(
        '<item id="cover-image" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>',
      );
    }

    const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:${project.id}</dc:identifier>
    <dc:title>${escapeXml(project.title)}</dc:title>
    <dc:language>${escapeXml(options.language)}</dc:language>
    <dc:description>${escapeXml(project.description)}</dc:description>
    ${options.publisher ? `<dc:publisher>${escapeXml(options.publisher)}</dc:publisher>` : ''}
    <meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`;

    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

    const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Table of Contents</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
      ${options.includeTableOfContents ? navLinks : ''}
    </ol>
  </nav>
</body>
</html>`;

    const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${project.id}"/>
  </head>
  <docTitle><text>${escapeXml(project.title)}</text></docTitle>
  <navMap>
${ncxPoints}
  </navMap>
</ncx>`;

    const archive = new ZipArchive({ zlib: { level: 9 } });
    const output = createWriteStream(outputPath);
    archive.pipe(output);

    archive.append('application/epub+zip', { name: 'mimetype', store: true });
    archive.append(containerXml, { name: 'META-INF/container.xml' });
    archive.append(contentOpf, { name: 'OEBPS/content.opf' });
    archive.append(tocNcx, { name: 'OEBPS/toc.ncx' });
    archive.append(navXhtml, { name: 'OEBPS/nav.xhtml' });
    archive.append(stylesheet, { name: 'OEBPS/styles/main.css' });

    chapters.forEach((chapter, index) => {
      archive.append(chapterXhtml(chapter, index), {
        name: `OEBPS/chapters/ch-${index + 1}.xhtml`,
      });
    });

    if (options.coverImagePath) {
      archive.file(options.coverImagePath, { name: 'OEBPS/cover.jpg' });
    }

    await archive.finalize();
    await finished(output);
    return outputPath;
  }

  async validateEPUB(filePath: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      await fs.access(filePath);
    } catch {
      return { valid: false, issues: ['File does not exist'] };
    }

    const bytes = await fs.readFile(filePath);
    const content = bytes.toString('latin1');

    const required = [
      'mimetype',
      'META-INF/container.xml',
      'OEBPS/content.opf',
      'OEBPS/toc.ncx',
      'OEBPS/nav.xhtml',
    ];

    for (const entry of required) {
      if (!content.includes(entry)) {
        issues.push(`Missing expected EPUB entry: ${entry}`);
      }
    }

    if (!content.includes('application/epub+zip')) {
      issues.push('Missing or invalid mimetype');
    }

    if (!content.includes('version="3.0"')) {
      issues.push('Package metadata is not EPUB 3.0');
    }

    return { valid: issues.length === 0, issues };
  }
}

export const epubBuilder = new EPUBBuilder();

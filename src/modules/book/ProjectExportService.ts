import fs from 'fs/promises';
import path from 'path';
import { ZipArchive } from 'archiver';
import { createWriteStream } from 'fs';
import { getConfig } from '../../shared/config';
import { getProjectChapters } from '../../shared/elevationHelpers';
import { extractOutputText } from '../../shared/outputSemantics';
import { projectBibleService } from '../manuscript/ProjectBibleService';
import { ProjectService } from '../manuscript/ProjectService';
import { ResearchService } from '../manuscript/ResearchService';
import { outputRegistry } from '../outputs';
import { bookMapService } from './BookMapService';
import { projectSnapshotService } from './ProjectSnapshotService';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraph(text: string, style?: 'Title' | 'Heading1'): string {
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  const lines = text.split('\n');
  return lines
    .map((line) => `<w:p>${pPr}<w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`)
    .join('');
}

async function writeDocxFile(filePath: string, bodyXml: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(filePath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);

    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
      { name: '[Content_Types].xml' },
    );
    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
      { name: '_rels/.rels' },
    );
    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}<w:sectPr/></w:body>
</w:document>`,
      { name: 'word/document.xml' },
    );
    void archive.finalize();
  });
}

export class ProjectExportService {
  private readonly projectService = new ProjectService();
  private readonly researchService = new ResearchService();

  async exportMarkdownManuscript(projectId: string, user?: import('../auth/types').UserPublic): Promise<string> {
    const project = await this.projectService.getProject(projectId, user);
    const chapters = await getProjectChapters(projectId);
    const lines = [`# ${project.title}`, '', project.description ?? '', ''];
    for (const chapter of chapters) {
      lines.push(`## ${chapter.title}`, '', chapter.content, '');
    }
    return lines.join('\n');
  }

  async exportDocxManuscript(
    projectId: string,
    user?: import('../auth/types').UserPublic,
  ): Promise<{ docxPath: string; outputId: string; filename: string }> {
    const project = await this.projectService.getProject(projectId, user);
    const chapters = await getProjectChapters(projectId);
    const parts = [
      paragraph(project.title, 'Title'),
      paragraph(''),
      ...(project.description ? [paragraph(project.description), paragraph('')] : []),
    ];
    for (const chapter of chapters) {
      parts.push(paragraph(chapter.title, 'Heading1'));
      parts.push(paragraph(''));
      parts.push(paragraph(chapter.content));
      parts.push(paragraph(''));
    }

    const exportDir = path.join(getConfig().dataDir, 'exports', projectId);
    await fs.mkdir(exportDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTitle = project.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'manuscript';
    const filename = `${safeTitle}-${stamp}.docx`;
    const docxPath = path.join(exportDir, filename);
    await writeDocxFile(docxPath, parts.join(''));

    const record = await outputRegistry.register({
      projectId,
      type: 'export-package',
      title: `DOCX manuscript — ${project.title}`,
      path: docxPath,
      metadata: {
        kind: 'export-package',
        format: 'docx',
        docxPath,
        filename,
        destination: 'export-package',
      },
    });

    return { docxPath, outputId: record.id, filename };
  }

  async exportProjectArchive(
    projectId: string,
    user?: import('../auth/types').UserPublic,
  ): Promise<{ archivePath: string; outputId: string }> {
    const project = await this.projectService.getProject(projectId, user);
    const [bible, bookMap, chapters, notes, outputs, snapshots] = await Promise.all([
      projectBibleService.get(projectId),
      bookMapService.get(projectId, user),
      getProjectChapters(projectId),
      this.researchService.listNotes(projectId),
      outputRegistry.list({ projectId }),
      projectSnapshotService.list(projectId, user),
    ]);

    const exportDir = path.join(getConfig().dataDir, 'exports', projectId);
    await fs.mkdir(exportDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const workDir = path.join(exportDir, stamp);
    await fs.mkdir(workDir, { recursive: true });

    const manuscript = chapters.map((c) => `## ${c.title}\n\n${c.content}`).join('\n\n');
    await fs.writeFile(path.join(workDir, 'manuscript.md'), `# ${project.title}\n\n${manuscript}`, 'utf-8');

    await fs.writeFile(
      path.join(workDir, 'project-bible.md'),
      `# Project Bible\n\nPremise: ${bible.premise}\n\nStructure: ${bible.structure}\n`,
      'utf-8',
    );

    if (bookMap) {
      await fs.writeFile(
        path.join(workDir, 'book-map.md'),
        `# Book Map\n\n${bookMap.arcSummary}\n\nMissing: ${bookMap.missingSections.join(', ')}\n`,
        'utf-8',
      );
    }

    await fs.mkdir(path.join(workDir, 'saved-writing'), { recursive: true });
    for (const output of outputs.slice(0, 50)) {
      const text = extractOutputText(output.metadata);
      await fs.writeFile(
        path.join(workDir, 'saved-writing', `${output.id.slice(0, 8)}.md`),
        `# ${output.title}\n\n${text}`,
        'utf-8',
      );
    }

    await fs.mkdir(path.join(workDir, 'research'), { recursive: true });
    for (const note of notes) {
      await fs.writeFile(
        path.join(workDir, 'research', `${note.id.slice(0, 8)}.md`),
        `# ${note.title}\n\n${note.content}`,
        'utf-8',
      );
    }

    await fs.writeFile(
      path.join(workDir, 'metadata.json'),
      JSON.stringify({
        projectId,
        title: project.title,
        exportedAt: new Date().toISOString(),
        chapterCount: chapters.length,
        outputCount: outputs.length,
        snapshotCount: snapshots.length,
      }, null, 2),
      'utf-8',
    );

    const archivePath = path.join(exportDir, `${stamp}.zip`);
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(archivePath);
      const archive = new ZipArchive({ zlib: { level: 9 } });
      output.on('close', () => resolve());
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(workDir, 'Project');
      void archive.finalize();
    });

    const record = await outputRegistry.register({
      projectId,
      type: 'export-package',
      title: `Project archive — ${project.title}`,
      path: archivePath,
      metadata: {
        kind: 'export-package',
        format: 'zip',
        archivePath,
        destination: 'export-package',
      },
    });

    return { archivePath, outputId: record.id };
  }
}

export const projectExportService = new ProjectExportService();

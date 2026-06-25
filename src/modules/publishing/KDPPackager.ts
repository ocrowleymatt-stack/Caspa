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
import { pdfAssembler, type PDFOptions } from './PDFAssembler';

const DEFAULT_INTERIOR_OPTIONS: PDFOptions = {
  pageSize: '6x9',
  fontSize: 11,
  lineSpacing: 1.5,
  margins: { top: 72, bottom: 72, left: 54, right: 54 },
  includeTableOfContents: true,
  includeChapterNumbers: true,
  headerStyle: 'title',
  footerStyle: 'pageNumber',
  font: 'Times New Roman',
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class KDPPackager {
  private async getProjectChapters(projectId: string): Promise<Chapter[]> {
    const chapters = await readCollection<Chapter>('chapters');
    return chapters
      .filter((chapter) => chapter.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  }

  generateMetadataXML(project: Project): string {
    const now = new Date().toISOString().slice(0, 10);
    return `<?xml version="1.0" encoding="UTF-8"?>
<ONIXMessage release="3.0" xmlns="http://ns.editeur.org/onix/3.0/reference">
  <Header>
    <Sender>
      <SenderName>CASPA Studio</SenderName>
    </Sender>
    <SentDateTime>${now}</SentDateTime>
  </Header>
  <Product>
    <RecordReference>${escapeXml(project.id)}</RecordReference>
    <NotificationType>03</NotificationType>
    <ProductIdentifier>
      <ProductIDType>15</ProductIDType>
      <IDValue>9780000000000</IDValue>
    </ProductIdentifier>
    <DescriptiveDetail>
      <ProductComposition>00</ProductComposition>
      <ProductForm>ED</ProductForm>
      <TitleDetail>
        <TitleType>01</TitleType>
        <TitleElement>
          <TitleElementLevel>01</TitleElementLevel>
          <TitleText>${escapeXml(project.title)}</TitleText>
        </TitleElement>
      </TitleDetail>
      <Subject>
        <SubjectSchemeIdentifier>12</SubjectSchemeIdentifier>
        <SubjectCode>${escapeXml(project.genre.slice(0, 4).toUpperCase())}</SubjectCode>
      </Subject>
    </DescriptiveDetail>
    <CollateralDetail>
      <TextContent>
        <TextType>03</TextType>
        <ContentAudience>00</ContentAudience>
        <Text>${escapeXml(project.description)}</Text>
      </TextContent>
    </CollateralDetail>
    <PublishingDetail>
      <PublishingStatus>04</PublishingStatus>
      <PublishingDate>
        <PublishingDateRole>01</PublishingDateRole>
        <Date dateformat="00">${now.replace(/-/g, '')}</Date>
      </PublishingDate>
    </PublishingDetail>
  </Product>
</ONIXMessage>`;
  }

  async validateForKDP(
    projectId: string,
  ): Promise<{ ready: boolean; issues: string[] }> {
    const issues: string[] = [];
    const project = await findById<Project>('projects', projectId);

    if (!project) {
      return { ready: false, issues: [`Project not found: ${projectId}`] };
    }

    if (!project.title.trim()) {
      issues.push('Project title is required');
    }

    if (!project.description.trim()) {
      issues.push('Project description is required for KDP metadata');
    }

    const chapters = await this.getProjectChapters(projectId);
    if (chapters.length === 0) {
      issues.push('Project has no chapters');
    }

    const emptyChapters = chapters.filter((chapter) => !chapter.content.trim());
    if (emptyChapters.length > 0) {
      issues.push(`${emptyChapters.length} chapter(s) have no content`);
    }

    if (project.currentWordCount < 100) {
      issues.push('Manuscript word count is very low for KDP publication');
    }

    return { ready: issues.length === 0, issues };
  }

  private async createZip(
    projectId: string,
    suffix: string,
    files: { source: string; name: string }[],
    extraEntries: { name: string; content: string }[] = [],
  ): Promise<string> {
    const outputDir = path.join(getConfig().dataDir, 'exports', projectId);
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${projectId}-${suffix}-${Date.now()}.zip`);

    const archive = new ZipArchive({ zlib: { level: 9 } });
    const output = createWriteStream(outputPath);
    archive.pipe(output);

    for (const file of files) {
      archive.file(file.source, { name: file.name });
    }

    for (const entry of extraEntries) {
      archive.append(entry.content, { name: entry.name });
    }

    await archive.finalize();
    await finished(output);
    return outputPath;
  }

  async generateKDPPackage(projectId: string): Promise<string> {
    const project = await findById<Project>('projects', projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const pdfPath = await pdfAssembler.assemblePDF(projectId, DEFAULT_INTERIOR_OPTIONS);
    const coverPath = await pdfAssembler.generateCoverPage(project, {
      title: project.title,
      author: 'Author',
      backgroundColor: '#1a1a2e',
      textColor: '#ffffff',
    });

    const metadata = {
      title: project.title,
      description: project.description,
      genre: project.genre,
      wordCount: project.currentWordCount,
      generatedAt: new Date().toISOString(),
    };

    const checklist = [
      'KDP Upload Checklist',
      '====================',
      `[ ] Interior PDF: ${path.basename(pdfPath)}`,
      `[ ] Cover PDF: ${path.basename(coverPath)}`,
      '[ ] Metadata JSON reviewed',
      '[ ] ONIX XML reviewed',
      '[ ] Pricing and territories configured in KDP dashboard',
    ].join('\n');

    return this.createZip(
      projectId,
      'kdp',
      [
        { source: pdfPath, name: 'interior.pdf' },
        { source: coverPath, name: 'cover.pdf' },
      ],
      [
        { name: 'metadata.json', content: JSON.stringify(metadata, null, 2) },
        { name: 'metadata.onix.xml', content: this.generateMetadataXML(project) },
        { name: 'checklist.txt', content: checklist },
      ],
    );
  }

  async generateIngramPackage(projectId: string): Promise<string> {
    const project = await findById<Project>('projects', projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const chapters = await this.getProjectChapters(projectId);
    const interiorPath = await pdfAssembler.assemblePDF(projectId, {
      ...DEFAULT_INTERIOR_OPTIONS,
      pageSize: '6x9',
    });
    const coverPath = await pdfAssembler.generateCoverPage(project, {
      title: project.title,
      author: 'Author',
      backgroundColor: '#000000',
      textColor: '#ffffff',
    });

    const pageCount = Math.max(1, Math.ceil(project.currentWordCount / 250));
    const spineWidth = (pageCount * 0.002252).toFixed(3);
    const spineCalculator = [
      'IngramSpark Spine Calculator',
      '============================',
      `Trim size: 6 x 9 inches`,
      `Estimated page count: ${pageCount}`,
      `Spine width (inches): ${spineWidth}`,
      `Paper type: white (0.002252" per page)`,
    ].join('\n');

    const onix = this.generateMetadataXML(project);
    const readme = [
      'IngramSpark Package',
      '===================',
      'interior.pdf — print-ready interior (convert to CMYK before upload)',
      'cover.pdf — full cover wrap (convert to CMYK before upload)',
      'metadata.onix.xml — ONIX 3.0 bibliographic metadata',
      'spine-calculator.txt — estimated spine width',
      `Chapters included: ${chapters.length}`,
    ].join('\n');

    return this.createZip(
      projectId,
      'ingram',
      [
        { source: interiorPath, name: 'interior.pdf' },
        { source: coverPath, name: 'cover.pdf' },
      ],
      [
        { name: 'metadata.onix.xml', content: onix },
        { name: 'spine-calculator.txt', content: spineCalculator },
        { name: 'readme.txt', content: readme },
      ],
    );
  }
}

export const kdpPackager = new KDPPackager();

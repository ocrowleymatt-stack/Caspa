import * as fs from 'fs';
import * as path from 'path';

interface ExportMetadata {
  isbn: string;
  title: string;
  author: string;
  description: string;
  category: string;
  keywords: string[];
  language: string;
  copyrightYear: number;
  publisherName: string;
}

interface KDPExportPackage {
  projectName: string;
  files: {
    manuscriptPDF: string;
    coverPDF: string;
    metadata: ExportMetadata;
  };
  kdpFormat: 'paperback' | 'hardcover' | 'ebook';
  distributionRights: 'kdp-exclusive' | 'wide';
}

interface IngramSparkPackage {
  projectName: string;
  files: {
    manuscriptPDF: string;
    coverPDF: string;
    metadata: ExportMetadata;
  };
  ingramFormat: 'paperback' | 'hardcover';
  binSize: '6x9' | '5.5x8.5' | '8x10';
}

export class OneClickExportService {
  /**
   * Generate KDP metadata template
   */
  generateKDPMetadata(metadata: ExportMetadata): string {
    return `
<?xml version="1.0" encoding="UTF-8"?>
<package>
  <title>${metadata.title}</title>
  <author>${metadata.author}</author>
  <description>${metadata.description}</description>
  <isbn>${metadata.isbn}</isbn>
  <category>${metadata.category}</category>
  <keywords>${metadata.keywords.join(',')}</keywords>
  <language>${metadata.language}</language>
  <copyrightYear>${metadata.copyrightYear}</copyrightYear>
  <publisherName>${metadata.publisherName}</publisherName>
  <publicationDate>${new Date().toISOString().split('T')[0]}</publicationDate>
</package>
`;
  }

  /**
   * Generate IngramSpark metadata (ONIX standard)
   */
  generateIngramSparkONIX(metadata: ExportMetadata): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<ONIXMessage release="3.0">
  <Header>
    <Sender>
      <SenderName>Caspa Publishing</SenderName>
      <ContactDetails>
        <Website>https://caspa.ocrowley.com</Website>
      </ContactDetails>
    </Sender>
    <SentDateTime>${new Date().toISOString()}</SentDateTime>
  </Header>
  <Product>
    <RecordReference>${metadata.isbn}</RecordReference>
    <ISBN>${metadata.isbn}</ISBN>
    <Title>
      <TitleText>${metadata.title}</TitleText>
    </Title>
    <Contributor>
      <ContributorRole>A01</ContributorRole>
      <PersonName>${metadata.author}</PersonName>
    </Contributor>
    <Description>${metadata.description}</Description>
    <Subject>
      <SubjectSchemeIdentifier>${metadata.category}</SubjectSchemeIdentifier>
    </Subject>
    <PublishingDetails>
      <Imprint>
        <ImprintName>${metadata.publisherName}</ImprintName>
      </Imprint>
      <PublicationDate>${new Date().toISOString().split('T')[0]}</PublicationDate>
    </PublishingDetails>
  </Product>
</ONIXMessage>
`;
  }

  /**
   * Create KDP export package
   */
  async createKDPPackage(
    projectName: string,
    manuscriptPDF: string,
    coverPDF: string,
    metadata: ExportMetadata,
    format: 'paperback' | 'hardcover' | 'ebook' = 'paperback'
  ): Promise<KDPExportPackage> {
    const kdpMetadata = this.generateKDPMetadata(metadata);

    return {
      projectName,
      files: {
        manuscriptPDF,
        coverPDF,
        metadata
      },
      kdpFormat: format,
      distributionRights: 'wide'
    };
  }

  /**
   * Create IngramSpark export package
   */
  async createIngramSparkPackage(
    projectName: string,
    manuscriptPDF: string,
    coverPDF: string,
    metadata: ExportMetadata,
    format: 'paperback' | 'hardcover' = 'paperback',
    binSize: '6x9' | '5.5x8.5' | '8x10' = '6x9'
  ): Promise<IngramSparkPackage> {
    const onixMetadata = this.generateIngramSparkONIX(metadata);

    return {
      projectName,
      files: {
        manuscriptPDF,
        coverPDF,
        metadata
      },
      ingramFormat: format,
      binSize
    };
  }

  /**
   * Validate book dimensions for KDP
   */
  validateKDPDimensions(widthInches: number, heightInches: number): {
    valid: boolean;
    message: string;
  } {
    const kdpSizes: Array<[number, number]> = [
      [5, 8],
      [5.25, 8],
      [5.5, 8.5],
      [6, 9],
      [6.14, 9.21],
      [7, 10],
      [8, 10],
      [8.5, 11]
    ];

    const isValid = kdpSizes.some(([w, h]) => Math.abs(w - widthInches) < 0.1 && Math.abs(h - heightInches) < 0.1);

    return {
      valid: isValid,
      message: isValid ? 'Dimensions approved for KDP' : `Invalid dimensions. Supported: ${kdpSizes.map(s => `${s[0]}x${s[1]}"`).join(', ')}`
    };
  }

  /**
   * Validate book dimensions for IngramSpark
   */
  validateIngramDimensions(widthInches: number, heightInches: number): {
    valid: boolean;
    message: string;
  } {
    const ingramSizes: Array<[number, number]> = [
      [5.5, 8.5],
      [6, 9],
      [8, 10],
      [8.5, 11]
    ];

    const isValid = ingramSizes.some(([w, h]) => Math.abs(w - widthInches) < 0.1 && Math.abs(h - heightInches) < 0.1);

    return {
      valid: isValid,
      message: isValid ? 'Dimensions approved for IngramSpark' : `Invalid dimensions. Supported: ${ingramSizes.map(s => `${s[0]}x${s[1]}"`).join(', ')}`
    };
  }

  /**
   * Generate print specifications checklist
   */
  generatePrintChecklist(platform: 'kdp' | 'ingramspark'): string[] {
    const common = [
      '✓ PDF is 300 DPI minimum',
      '✓ Color space is CMYK (or RGB with note)',
      '✓ Bleeds set to 3.5mm or greater',
      '✓ Safety zone: 5mm from trim edge',
      '✓ No text in safety zone',
      '✓ Fonts embedded or standard',
      '✓ No crop marks outside bleed'
    ];

    const kdpSpecific = [
      '✓ Interior PDF margins correct',
      '✓ Cover must include spine calculation',
      '✓ Back matter not exceeding limits'
    ];

    const ingramSpecific = [
      '✓ ONIX metadata file included',
      '✓ ISBN on back cover barcode',
      '✓ Copyright page correctly formatted',
      '✓ Standard retail-ready trim sizes'
    ];

    return [
      ...common,
      ...(platform === 'kdp' ? kdpSpecific : ingramSpecific)
    ];
  }

  /**
   * One-click export coordinator
   */
  async executeOneClickExport(params: {
    projectName: string;
    manuscriptPDF: string;
    coverPDF: string;
    metadata: ExportMetadata;
    platforms: Array<'kdp' | 'ingramspark'>;
    formats: { kdp?: 'paperback' | 'hardcover' | 'ebook'; ingramSpark?: 'paperback' | 'hardcover' };
  }): Promise<{
    kdp?: KDPExportPackage;
    ingramSpark?: IngramSparkPackage;
    checklist: string[];
    nextSteps: string[];
  }> {
    const result: any = { checklist: this.generatePrintChecklist('kdp'), nextSteps: [] };

    for (const platform of params.platforms) {
      if (platform === 'kdp') {
        result.kdp = await this.createKDPPackage(
          params.projectName,
          params.manuscriptPDF,
          params.coverPDF,
          params.metadata,
          params.formats.kdp || 'paperback'
        );
        result.nextSteps.push('1. Log in to KDP Author Dashboard');
        result.nextSteps.push('2. Create new book project');
        result.nextSteps.push('3. Upload interior PDF and cover');
        result.nextSteps.push('4. Review and publish');
      }

      if (platform === 'ingramspark') {
        result.ingramSpark = await this.createIngramSparkPackage(
          params.projectName,
          params.manuscriptPDF,
          params.coverPDF,
          params.metadata,
          params.formats.ingramSpark || 'paperback'
        );
        result.nextSteps.push('1. Create IngramSpark account');
        result.nextSteps.push('2. Set up book profile');
        result.nextSteps.push('3. Upload ONIX metadata');
        result.nextSteps.push('4. Upload print files');
        result.nextSteps.push('5. Submit for review');
      }
    }

    return result;
  }
}

import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { ZipArchive } from 'archiver';
import {
  findById,
  generateId,
  getConfig,
  logger,
  readCollection,
  upsert,
  type Chapter,
  type Character,
  type Project,
  type ShowPackage,
} from '../../shared';
import { AIOrchestrator, aiOrchestrator } from '../ai';
import { NotFoundError, ProjectService } from '../manuscript';
import { showFactoryService } from '../show-factory';

export interface CommercialReadinessReport {
  projectId: string;
  overallScore: number;
  categories: {
    manuscriptCompleteness: number;
    marketability: number;
    productionReadiness: number;
    platformReadiness: number;
  };
  recommendations: string[];
  blockers: string[];
  generatedAt: string;
}

export interface MarketingCopyPack {
  tagline: string;
  blurb100: string;
  blurb50: string;
  blurb25: string;
  amazonDescription: string;
  authorBio: string;
  targetAudience: string;
  comparableTitles: string[];
  keywords: string[];
  categories: string[];
}

export interface SocialMediaPack {
  tweets: string[];
  instagramCaptions: string[];
  facebookPost: string;
  linkedInPost: string;
  newsletterTeaser: string;
  launchDayPost: string;
  hashtags: string[];
}

const REPORTS = 'commercial-readiness-reports';

export class CommercialReadinessEngine {
  private readonly projectService = new ProjectService();

  constructor(private readonly orchestrator: AIOrchestrator = aiOrchestrator) {}

  private outputDir(projectId: string): string {
    return path.join(getConfig().dataDir, 'show-box', projectId);
  }

  async assessProject(projectId: string): Promise<CommercialReadinessReport> {
    const project = await this.projectService.getProject(projectId);
    const [chapters, characters, showPackages] = await Promise.all([
      readCollection<Chapter>('chapters'),
      readCollection<Character>('characters'),
      showFactoryService.listShowPackages(projectId),
    ]);

    const projectChapters = chapters.filter((chapter) => chapter.projectId === projectId);
    const projectCharacters = characters.filter((character) => character.projectId === projectId);
    const wordCount = projectChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
    const targetWords = project.targetWordCount || 80000;

    const manuscriptCompleteness = Math.min(
      100,
      Math.round((wordCount / targetWords) * 60 + (projectChapters.length > 0 ? 20 : 0) + (project.status === 'complete' ? 20 : 0)),
    );

    const marketability = Math.min(
      100,
      Math.round(
        (project.description.length > 100 ? 25 : 10) +
          (project.genre.length > 0 ? 25 : 0) +
          (projectCharacters.length >= 3 ? 25 : projectCharacters.length * 8) +
          (project.title.length > 3 ? 25 : 10),
      ),
    );

    const readyPackages = showPackages.filter((pkg) => pkg.status === 'ready' || pkg.status === 'exported');
    const productionReadiness = Math.min(
      100,
      Math.round(
        (readyPackages.length > 0 ? 50 : 0) +
          (readyPackages.some((pkg) => pkg.type === 'theatre') ? 25 : 0) +
          (readyPackages.some((pkg) => pkg.type === 'radio' || pkg.type === 'podcast') ? 25 : 0),
      ),
    );

    const platformReadiness = Math.min(
      100,
      Math.round(
        (project.status !== 'draft' ? 30 : 10) +
          (wordCount >= 50000 ? 35 : Math.round((wordCount / 50000) * 35)) +
          (projectCharacters.length >= 2 ? 20 : 0) +
          (readyPackages.length > 0 ? 15 : 0),
      ),
    );

    const categories = {
      manuscriptCompleteness,
      marketability,
      productionReadiness,
      platformReadiness,
    };

    const overallScore = Math.round(
      (manuscriptCompleteness + marketability + productionReadiness + platformReadiness) / 4,
    );

    const blockers: string[] = [];
    const recommendations: string[] = [];

    if (manuscriptCompleteness < 70) {
      blockers.push('Manuscript is incomplete — target word count not yet reached.');
      recommendations.push('Continue drafting chapters to reach your target word count.');
    }
    if (projectCharacters.length < 3) {
      recommendations.push('Develop at least three named characters to strengthen market appeal.');
    }
    if (readyPackages.length === 0) {
      blockers.push('No show packages generated — production assets missing.');
      recommendations.push('Generate a theatre or radio show package via Show Factory.');
    }
    if (marketability < 60) {
      recommendations.push('Expand the project description and refine the genre positioning.');
    }
    if (platformReadiness < 50) {
      recommendations.push('Complete manuscript draft before platform submission.');
    }
    if (overallScore >= 75 && blockers.length === 0) {
      recommendations.push('Project is commercially viable — generate marketing copy and press kit.');
    }

    const report: CommercialReadinessReport = {
      projectId,
      overallScore,
      categories,
      recommendations,
      blockers,
      generatedAt: new Date().toISOString(),
    };

    await upsert(REPORTS, { id: projectId, ...report });
    logger.info(`Commercial readiness assessed for ${projectId}: ${overallScore}/100`);

    return report;
  }

  async getLatestReport(projectId: string): Promise<CommercialReadinessReport> {
    const stored = await findById<CommercialReadinessReport & { id: string }>(REPORTS, projectId);
    if (!stored) {
      return this.assessProject(projectId);
    }
    const { id: _id, ...report } = stored;
    return report;
  }

  async generatePitchDeck(projectId: string): Promise<string> {
    const project = await this.projectService.getProject(projectId);
    const report = await this.getLatestReport(projectId);

    const response = await this.orchestrator.generateWithContext(
      {
        prompt: `Create a professional pitch deck in markdown for the creative project "${project.title}".

Include these sections:
1. Title slide
2. Logline
3. Synopsis
4. Target audience
5. Market opportunity
6. Comparable titles
7. Production plan
8. Commercial readiness score: ${report.overallScore}/100
9. Revenue streams
10. Team / author vision
11. Call to action

Write compelling, investor-ready copy.`,
        temperature: 0.7,
      },
      projectId,
    );

    const dir = await this.ensureOutputDir(projectId);
    const filePath = path.join(dir, 'pitch-deck.md');
    await fs.writeFile(filePath, response.text, 'utf-8');
    return filePath;
  }

  async generateMarketingCopy(projectId: string): Promise<MarketingCopyPack> {
    const project = await this.projectService.getProject(projectId);

    const response = await this.orchestrator.generateWithContext(
      {
        prompt: `Generate marketing copy for "${project.title}" (${project.genre}).

Return ONLY valid JSON with these exact fields:
{
  "tagline": "short catchy tagline",
  "blurb100": "exactly ~100 word back cover blurb",
  "blurb50": "exactly ~50 word pitch",
  "blurb25": "exactly ~25 word logline",
  "amazonDescription": "~600 word SEO-optimised Amazon description",
  "authorBio": "author bio paragraph",
  "targetAudience": "target audience description",
  "comparableTitles": ["title1", "title2", "title3"],
  "keywords": ["keyword1", "keyword2"],
  "categories": ["Amazon BISAC category1", "category2"]
}`,
        temperature: 0.7,
      },
      projectId,
    );

    const pack = this.parseJson<MarketingCopyPack>(response.text, {
      tagline: project.title,
      blurb100: project.description,
      blurb50: project.description.slice(0, 300),
      blurb25: project.description.slice(0, 150),
      amazonDescription: project.description,
      authorBio: 'Author bio pending.',
      targetAudience: 'General fiction readers',
      comparableTitles: [],
      keywords: [project.genre],
      categories: ['Fiction / General'],
    });

    const dir = await this.ensureOutputDir(projectId);
    await fs.writeFile(path.join(dir, 'marketing-copy.json'), JSON.stringify(pack, null, 2), 'utf-8');

    return pack;
  }

  async generateSocialPack(projectId: string): Promise<SocialMediaPack> {
    const project = await this.projectService.getProject(projectId);

    const response = await this.orchestrator.generateWithContext(
      {
        prompt: `Generate a social media launch pack for "${project.title}" (${project.genre}).

Return ONLY valid JSON with these exact fields:
{
  "tweets": ["tweet1", "tweet2", "tweet3", "tweet4", "tweet5"],
  "instagramCaptions": ["caption1", "caption2", "caption3"],
  "facebookPost": "facebook post text",
  "linkedInPost": "linkedin post text",
  "newsletterTeaser": "newsletter teaser",
  "launchDayPost": "launch day announcement",
  "hashtags": ["#tag1", "#tag2"]
}`,
        temperature: 0.8,
      },
      projectId,
    );

    const pack = this.parseJson<SocialMediaPack>(response.text, {
      tweets: [`Discover ${project.title}!`, `Coming soon: ${project.title}`, `New from ${project.genre}: ${project.title}`, `Don't miss ${project.title}`, `Launch alert: ${project.title}`],
      instagramCaptions: [project.description.slice(0, 200), `Behind the scenes: ${project.title}`, `Mark your calendar for ${project.title}`],
      facebookPost: project.description,
      linkedInPost: `Excited to announce ${project.title} — ${project.description.slice(0, 280)}`,
      newsletterTeaser: project.description.slice(0, 400),
      launchDayPost: `Today is launch day for ${project.title}!`,
      hashtags: [`#${project.genre.replace(/\s+/g, '')}`, '#NewRelease', '#BookLaunch'],
    });

    const dir = await this.ensureOutputDir(projectId);
    await fs.writeFile(path.join(dir, 'social-pack.json'), JSON.stringify(pack, null, 2), 'utf-8');

    return pack;
  }

  async generatePressKit(projectId: string): Promise<string> {
    const project = await this.projectService.getProject(projectId);
    const report = await this.getLatestReport(projectId);

    const [pitchDeckPath, marketingCopy, socialPack] = await Promise.all([
      this.generatePitchDeck(projectId),
      this.generateMarketingCopy(projectId),
      this.generateSocialPack(projectId),
    ]);

    const dir = await this.ensureOutputDir(projectId);
    const summaryPath = path.join(dir, 'project-summary.md');
    await fs.writeFile(
      summaryPath,
      `# ${project.title}\n\n**Genre:** ${project.genre}\n\n**Description:** ${project.description}\n\n**Commercial Readiness:** ${report.overallScore}/100\n\n**Generated:** ${new Date().toISOString()}\n`,
      'utf-8',
    );

    const zipPath = path.join(dir, 'press-kit.zip');
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = new ZipArchive({ zlib: { level: 9 } });
      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);
      archive.pipe(output);
      archive.file(pitchDeckPath, { name: 'pitch-deck.md' });
      archive.file(summaryPath, { name: 'project-summary.md' });
      archive.file(path.join(dir, 'marketing-copy.json'), { name: 'marketing-copy.json' });
      archive.file(path.join(dir, 'social-pack.json'), { name: 'social-pack.json' });
      void archive.finalize();
    });

    logger.info(`Press kit generated for ${projectId}: ${zipPath}`);
    return zipPath;
  }

  getAssetPath(projectId: string, type: string): string {
    const dir = this.outputDir(projectId);
    const assetMap: Record<string, string> = {
      'pitch-deck': path.join(dir, 'pitch-deck.md'),
      'press-kit': path.join(dir, 'press-kit.zip'),
      'marketing': path.join(dir, 'marketing-copy.json'),
      'social': path.join(dir, 'social-pack.json'),
      'report': path.join(getConfig().dataDir, `${REPORTS}.json`),
    };
    const filePath = assetMap[type];
    if (!filePath) {
      throw new Error(`Unknown asset type: ${type}`);
    }
    return filePath;
  }

  private async ensureOutputDir(projectId: string): Promise<string> {
    const dir = this.outputDir(projectId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  private parseJson<T>(text: string, fallback: T): T {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as T;
        } catch {
          return fallback;
        }
      }
      return fallback;
    }
  }
}

export const commercialReadinessEngine = new CommercialReadinessEngine();

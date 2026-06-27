import { generateId, writeJsonFile, readJsonFile, listJsonFiles, deleteJsonFile } from '../../shared/fileStore';
import { ProjectService } from '../manuscript/ProjectService';
import type { AssetKind, DetectedUse, ProjectAsset } from './types';

const SUB_PATH = 'project-assets';

function assetPath(projectId: string, assetId: string): string {
  return `${projectId}/${assetId}.json`;
}

function detectUse(text: string, filename?: string): { kind: AssetKind; detectedUse: DetectedUse; summary: string } {
  const lower = text.toLowerCase();
  const name = (filename ?? '').toLowerCase();
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  if (name.includes('receipt') || /\$\d|total:|vat|invoice|paid/i.test(text.slice(0, 500))) {
    return { kind: 'receipt', detectedUse: 'receipt', summary: 'Receipt or admin fragment — usable as prop, clue, or world detail.' };
  }
  if (words < 80 && (name.includes('note') || lower.includes('fragment'))) {
    return { kind: 'unknown', detectedUse: 'unknown', summary: 'Short fragment — may seed a scene, prop, or research note.' };
  }
  if (/^chapter\s+\d|^#+\s+chapter|act\s+[ivx]+|scene\s+\d/i.test(text)) {
    return { kind: 'chapter', detectedUse: 'chapter', summary: 'Chapter or scene unit detected.' };
  }
  if (/outline|table of contents|^\d+\.\s/m.test(text.slice(0, 2000))) {
    return { kind: 'outline', detectedUse: 'outline', summary: 'Outline or structured plan material.' };
  }
  if (/character|protagonist|backstory|wound|desire/i.test(text.slice(0, 1500))) {
    return { kind: 'character-note', detectedUse: 'character note', summary: 'Character notes or sheets.' };
  }
  if (/setting|location|world|era|period/i.test(text.slice(0, 1500))) {
    return { kind: 'setting-note', detectedUse: 'setting note', summary: 'Setting or world-building notes.' };
  }
  if (words > 400) {
    return { kind: 'manuscript', detectedUse: 'manuscript', summary: `Manuscript-scale material (${words} words).` };
  }
  if (/research|source:|citation|according to/i.test(text)) {
    return { kind: 'research', detectedUse: 'research', summary: 'Research or reference material.' };
  }
  return { kind: 'unknown', detectedUse: 'unknown', summary: `Creative fragment (${words} words) — classify or tag for use.` };
}

export class ProjectAssetService {
  private readonly projectService = new ProjectService();

  async list(projectId: string, user?: import('../auth/types').UserPublic): Promise<ProjectAsset[]> {
    await this.projectService.getProject(projectId, user);
    const files = await listJsonFiles(`${SUB_PATH}/${projectId}`);
    const assets: ProjectAsset[] = [];
    for (const file of files) {
      const asset = await readJsonFile<ProjectAsset>(SUB_PATH, `${projectId}/${file}`);
      if (asset) assets.push(asset);
    }
    return assets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(projectId: string, assetId: string, user?: import('../auth/types').UserPublic): Promise<ProjectAsset | null> {
    await this.projectService.getProject(projectId, user);
    return readJsonFile<ProjectAsset>(SUB_PATH, assetPath(projectId, assetId));
  }

  async create(
    projectId: string,
    input: {
      title?: string;
      originalFilename?: string;
      mimeType?: string;
      sourceText: string;
      tags?: string[];
      kind?: AssetKind;
      detectedUse?: DetectedUse;
    },
    user?: import('../auth/types').UserPublic,
  ): Promise<ProjectAsset> {
    await this.projectService.getProject(projectId, user);
    const sourceText = input.sourceText.trim();
    if (!sourceText) throw new Error('sourceText is required');

    const detected = detectUse(sourceText, input.originalFilename);
    const now = new Date().toISOString();
    const asset: ProjectAsset = {
      id: generateId(),
      projectId,
      title: input.title?.trim() || input.originalFilename || `Asset ${now.slice(0, 10)}`,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sourceText,
      extractedText: sourceText,
      summary: detected.summary,
      kind: input.kind ?? detected.kind,
      detectedUse: input.detectedUse ?? detected.detectedUse,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
      metadata: { originalPreserved: true },
    };
    await writeJsonFile(SUB_PATH, assetPath(projectId, asset.id), asset);
    return asset;
  }

  async patch(
    projectId: string,
    assetId: string,
    patch: Partial<Pick<ProjectAsset, 'title' | 'kind' | 'detectedUse' | 'tags' | 'summary'>>,
    user?: import('../auth/types').UserPublic,
  ): Promise<ProjectAsset> {
    const existing = await this.get(projectId, assetId, user);
    if (!existing) throw new Error('Asset not found');
    const updated: ProjectAsset = {
      ...existing,
      ...patch,
      sourceText: existing.sourceText,
      extractedText: existing.extractedText,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFile(SUB_PATH, assetPath(projectId, assetId), updated);
    return updated;
  }

  async remove(projectId: string, assetId: string, user?: import('../auth/types').UserPublic): Promise<boolean> {
    await this.get(projectId, assetId, user);
    return deleteJsonFile(SUB_PATH, assetPath(projectId, assetId));
  }
}

export const projectAssetService = new ProjectAssetService();

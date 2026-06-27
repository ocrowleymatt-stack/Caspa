import { extractOutputText } from '../../shared/outputSemantics';
import { ChapterService } from '../manuscript/ChapterService';
import { ProjectService } from '../manuscript/ProjectService';
import { outputRegistry } from '../outputs';
import { projectSnapshotService } from './ProjectSnapshotService';
import type { StructureUnitType } from '../../shared/structureUnit';

export type ManuscriptApplyMode = 'replace-unit' | 'append-unit' | 'new-unit';

export interface ManuscriptApplyOutputRequest {
  projectId: string;
  outputId: string;
  mode: ManuscriptApplyMode;
  unitId?: string;
  newUnitTitle?: string;
  confirmed?: boolean;
}

export class ManuscriptApplyOutputService {
  private readonly projectService = new ProjectService();
  private readonly chapterService = new ChapterService();

  async apply(input: ManuscriptApplyOutputRequest, user?: import('../auth/types').UserPublic) {
    if (!input.confirmed) {
      throw new Error('confirmed:true is required — apply only after explicit user confirmation.');
    }

    await this.projectService.getProject(input.projectId, user);
    const output = await outputRegistry.get(input.outputId);
    if (!output || output.projectId !== input.projectId) {
      throw new Error('Output not found in this project.');
    }

    const meta = output.metadata ?? {};
    if (meta.applyBlocked || meta.driftBlocked) {
      throw new Error('This output is blocked from safe apply due to story drift. Keep as alternative or re-run Gold Pass.');
    }

    const text = extractOutputText(meta);
    if (!text.trim()) {
      throw new Error('Output has no readable text to apply.');
    }

    const unitId = input.unitId
      ?? (typeof meta.unitId === 'string' ? meta.unitId : undefined)
      ?? (typeof meta.sourceChapterId === 'string' ? meta.sourceChapterId : undefined)
      ?? (typeof meta.chapterId === 'string' ? meta.chapterId : undefined);

    const snapshot = await projectSnapshotService.create(
      input.projectId,
      {
        label: 'Before apply output',
        reason: `Snapshot before applying output ${output.id.slice(0, 8)} (${input.mode})`,
      },
      user,
    );

    if (input.mode === 'new-unit') {
      const chapters = await this.chapterService.listChapters(input.projectId);
      const created = await this.chapterService.createChapter({
        projectId: input.projectId,
        title: input.newUnitTitle?.trim() || `Applied — ${output.title}`,
        order: chapters.length,
        content: text,
        status: 'draft',
        unitType: 'chapter' as StructureUnitType,
        unitStatus: 'revision',
        sourceRole: 'ai-output',
        metadata: { appliedFromOutputId: output.id, snapshotId: snapshot.id },
      });
      return {
        applied: true,
        mode: input.mode,
        snapshotId: snapshot.id,
        unitId: created.id,
        outputId: output.id,
        wordCount: text.split(/\s+/).filter(Boolean).length,
      };
    }

    if (!unitId) {
      throw new Error('unitId required for replace or append apply.');
    }

    const chapter = await this.chapterService.getChapter(unitId);
    if (chapter.projectId !== input.projectId) {
      throw new Error('Unit does not belong to this project.');
    }

    const nextContent = input.mode === 'append-unit'
      ? `${chapter.content ?? ''}\n\n${text}`.trim()
      : text;

    const updated = await this.chapterService.updateChapter(unitId, {
      content: nextContent,
      wordCount: nextContent.split(/\s+/).filter(Boolean).length,
      metadata: {
        ...(chapter.metadata ?? {}),
        lastAppliedOutputId: output.id,
        lastApplySnapshotId: snapshot.id,
        lastApplyMode: input.mode,
      },
    });

    return {
      applied: true,
      mode: input.mode,
      snapshotId: snapshot.id,
      unitId: updated.id,
      outputId: output.id,
      wordCount: nextContent.split(/\s+/).filter(Boolean).length,
    };
  }
}

export const manuscriptApplyOutputService = new ManuscriptApplyOutputService();

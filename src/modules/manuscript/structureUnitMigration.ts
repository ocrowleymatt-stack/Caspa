import { readCollection, upsert, type Chapter, type Project } from '../../shared';
import {
  inferUnitTypeFromTitle,
  isAiRevisionTitle,
  isSourceManuscriptTitle,
  type StructureSourceRole,
  type StructureUnitStatus,
  type StructureUnitType,
} from '../../shared/structureUnit';
import type { WorkType } from '../../shared/workModel';
import { getDefaultsForWorkType } from '../../shared/workModel';

const CHAPTERS = 'chapters';
const PROJECTS = 'projects';

function defaultUnitTypeForProject(workType?: WorkType): StructureUnitType {
  if (!workType) return 'chapter';
  const structure = getDefaultsForWorkType(workType).structureType;
  if (structure === 'acts-scenes') return 'scene';
  if (structure === 'essays') return 'essay';
  if (structure === 'poems') return 'poem';
  if (structure === 'research-arguments') return 'argument';
  if (structure === 'sections' || structure === 'parts') return 'section';
  return 'chapter';
}

function hasStructureFields(chapter: Chapter): boolean {
  return Boolean(chapter.unitType && chapter.sourceRole);
}

export function normalizeStructureUnit(
  chapter: Chapter,
  project?: Pick<Project, 'workType'>,
): Chapter {
  if (hasStructureFields(chapter)) {
    return {
      ...chapter,
      metadata: chapter.metadata ?? {},
    };
  }

  let unitType: StructureUnitType = inferUnitTypeFromTitle(chapter.title);
  let sourceRole: StructureSourceRole = 'user-written';
  let unitStatus: StructureUnitStatus = chapter.status === 'final' ? 'approved' : 'draft';

  if (isSourceManuscriptTitle(chapter.title)) {
    unitType = 'section';
    sourceRole = 'original';
    unitStatus = 'source';
  } else if (isAiRevisionTitle(chapter.title)) {
    unitType = defaultUnitTypeForProject(project?.workType);
    sourceRole = 'ai-output';
    unitStatus = 'revision';
  } else if (chapter.title.toLowerCase().startsWith('imported')) {
    sourceRole = 'imported';
    unitStatus = 'source';
    unitType = defaultUnitTypeForProject(project?.workType);
  } else if (project?.workType) {
    const preferred = defaultUnitTypeForProject(project.workType);
    if (unitType === 'chapter' && preferred !== 'chapter') {
      unitType = preferred;
    }
  }

  return {
    ...chapter,
    unitType,
    sourceRole,
    unitStatus,
    metadata: chapter.metadata ?? {},
  };
}

export async function migrateChaptersStructureModel(): Promise<number> {
  const [chapters, projects] = await Promise.all([
    readCollection<Chapter>(CHAPTERS),
    readCollection<Project>(PROJECTS),
  ]);
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  let updated = 0;

  for (const chapter of chapters) {
    if (hasStructureFields(chapter)) continue;
    const normalized = normalizeStructureUnit(chapter, projectMap.get(chapter.projectId));
    await upsert(CHAPTERS, normalized);
    updated += 1;
  }

  return updated;
}

export interface StructureTreeNode {
  id: string;
  projectId: string;
  parentId?: string;
  unitType: StructureUnitType;
  title: string;
  order: number;
  wordCount: number;
  unitStatus?: StructureUnitStatus;
  sourceRole?: StructureSourceRole;
  status: Chapter['status'];
  children: StructureTreeNode[];
}

export function buildStructureTree(chapters: Chapter[]): StructureTreeNode[] {
  const normalized = chapters.map((chapter) => normalizeStructureUnit(chapter));
  const nodes = normalized.map((chapter) => ({
    id: chapter.id,
    projectId: chapter.projectId,
    parentId: chapter.parentId,
    unitType: chapter.unitType ?? 'chapter',
    title: chapter.title,
    order: chapter.order,
    wordCount: chapter.wordCount,
    unitStatus: chapter.unitStatus,
    sourceRole: chapter.sourceRole,
    status: chapter.status,
    children: [] as StructureTreeNode[],
  }));

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const roots: StructureTreeNode[] = [];

  for (const node of nodes) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRecursive = (list: StructureTreeNode[]) => {
    list.sort((a, b) => a.order - b.order);
    list.forEach((item) => sortRecursive(item.children));
  };
  sortRecursive(roots);
  return roots;
}

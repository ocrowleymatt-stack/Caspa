import { collection, deleteDoc, doc, getDocs, query, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Project } from '../types';
import { backupProjectSnapshotToDropbox } from './dropboxBackup';

const SUBCOLLECTIONS = [
  'characters',
  'plotNodes',
  'chapters',
  'research',
  'sourceMaterials',
  'externalReviews',
  'presence'
];

export function buildNewProject(userId: string, title = 'Untitled Narrative'): Project {
  const id = `project_${crypto.randomUUID()}`;
  const now = Date.now();
  return {
    id,
    title,
    type: 'novel',
    maturity: 'standard',
    genre: 'Gothic Thriller',
    premise: '',
    tone: 'Restrained literary gothic',
    collaborators: [],
    ownerId: userId,
    sourceMaterials: [],
    lastModified: now,
    createdAt: now,
    updatedAt: serverTimestamp() as any,
    stats: {
      narrativeStreak: 0,
      totalWords: 0,
      aiContributions: 0,
      lastActiveDay: new Date().toISOString().split('T')[0]
    }
  } as Project;
}

export async function createProjectSafe(userId: string, title = 'Untitled Narrative') {
  const project = buildNewProject(userId, title);
  await setDoc(doc(db, 'projects', project.id), project);
  return project;
}

async function deleteCollectionInBatches(projectId: string, subcollection: string) {
  const snap = await getDocs(query(collection(db, 'projects', projectId, subcollection)));
  const docs = snap.docs;
  const chunkSize = 400;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = writeBatch(db);
    docs.slice(i, i + chunkSize).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  return docs.length;
}

export async function deleteProjectSafe(args: {
  project: Project;
  chapters?: any[];
  characters?: any[];
  backupBeforeDelete?: boolean;
}) {
  const { project, chapters = [], characters = [], backupBeforeDelete = true } = args;
  if (!project?.id || project.id === 'default') throw new Error('No real project selected for deletion.');

  if (backupBeforeDelete) {
    await backupProjectSnapshotToDropbox({
      project,
      chapters,
      characters,
      reason: 'pre-delete-backup'
    });
  }

  const deleted: Record<string, number> = {};
  for (const subcollection of SUBCOLLECTIONS) {
    deleted[subcollection] = await deleteCollectionInBatches(project.id, subcollection);
  }

  await deleteDoc(doc(db, 'projects', project.id));
  return { projectId: project.id, deleted };
}

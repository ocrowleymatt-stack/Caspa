/**
 * Fix My Book: deterministic, non-destructive whole-book repair foundations.
 * No AI is allowed to overwrite protected material or fabricate verification.
 */
import { createHash, randomUUID } from 'node:crypto';

export type EvidenceStatus = 'verified' | 'unverified' | 'disputed' | 'retracted';
export interface Evidence { id: string; citation: string; sourceUrl?: string; doi?: string; page?: string; quote?: string; status: EvidenceStatus; checkedAt?: string; }
export interface Passage { id: string; text: string; approved?: boolean; evidenceIds?: string[]; }
export interface Section { id: string; title: string; passages: Passage[]; }
export interface Manuscript { title: string; kind: 'fiction' | 'nonfiction'; sections: Section[]; evidence: Evidence[]; }
export interface RepairChange { sectionId: string; passageId: string; replacement: string; rationale: string; evidenceIds?: string[]; }
export interface RepairIssue { severity: 'blocker' | 'warning'; code: string; message: string; location?: string; }
export interface RepairStage { name: string; targetWords: number; completedWords: number; }
export interface RescueVault { original: Manuscript; originalHash: string; protected: Passage[]; evidence: Evidence[]; createdAt: string; id: string; }
export interface RepairResult { revised: Manuscript; changes: Array<RepairChange & { before: string; after: string }>; rejected: RepairIssue[]; audit: RepairIssue[]; beforeWords: number; afterWords: number; }

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const words = (text: string) => text.trim() ? text.trim().split(/\\s+/).length : 0;
export const manuscriptText = (book: Manuscript) => book.sections.map(s => s.passages.map(p => p.text).join('\\n\\n')).join('\\n\\n');
export const wordCount = (book: Manuscript) => words(manuscriptText(book));
export const hashBook = (book: Manuscript) => createHash('sha256').update(JSON.stringify(book)).digest('hex');

export function createRescueVault(book: Manuscript): RescueVault {
  if (!book || !Array.isArray(book.sections) || !Array.isArray(book.evidence)) throw new Error('Invalid manuscript');
  const ids = new Set<string>();
  for (const section of book.sections) for (const p of section.passages) {
    if (!p.id || ids.has(p.id)) throw new Error('Passage IDs must be unique');
    ids.add(p.id);
  }
  return { id: randomUUID(), createdAt: new Date().toISOString(), original: clone(book), originalHash: hashBook(book), protected: clone(book.sections.flatMap(s => s.passages.filter(p => p.approved))), evidence: clone(book.evidence) };
}

export function planProgressiveConstruction(targetWords: number, currentWords = 0): RepairStage[] {
  if (!Number.isFinite(targetWords) || targetWords < 100) throw new Error('Invalid target length');
  const fractions = [['miniature', .0625], ['structure', .1875], ['drama', .4375], ['literary', .75], ['complete', 1]] as const;
  return fractions.map(([name, fraction]) => ({ name, targetWords: Math.max(1, Math.round(targetWords * fraction)), completedWords: currentWords }));
}

export function auditManuscript(book: Manuscript): RepairIssue[] {
  const issues: RepairIssue[] = [];
  const evidence = new Map(book.evidence.map(e => [e.id, e]));
  const seen = new Set<string>();
  for (const section of book.sections) {
    if (!section.passages.length) issues.push({ severity:'warning', code:'EMPTY_SECTION', message:'Section has no passages', location:section.id });
    for (const passage of section.passages) {
      if (seen.has(passage.id)) issues.push({ severity:'blocker', code:'DUPLICATE_PASSAGE_ID', message:'Passage ID repeated', location:passage.id });
      seen.add(passage.id);
      for (const id of passage.evidenceIds || []) {
        const source = evidence.get(id);
        if (!source) issues.push({ severity:'blocker', code:'MISSING_SOURCE', message:'Referenced evidence does not exist', location:passage.id });
        else if (source.status !== 'verified') issues.push({ severity:'warning', code:'UNVERIFIED_SOURCE', message:'Evidence status: '+source.status, location:passage.id });
        else if (!source.citation.trim() || (!source.doi && !source.sourceUrl && !source.quote)) issues.push({ severity:'warning', code:'WEAK_PROVENANCE', message:'Verified label lacks independently traceable provenance', location:passage.id });
      }
    }
  }
  return issues;
}

/** Apply proposed revisions to a COPY, retaining every original and a reviewable change log. */
export function applyRepair(vault: RescueVault, proposals: RepairChange[]): RepairResult {
  if (hashBook(vault.original) !== vault.originalHash) throw new Error('Original integrity check failed');
  const revised = clone(vault.original);
  const rejected: RepairIssue[] = [];
  const changes: RepairResult['changes'] = [];
  const protectedIds = new Set(vault.protected.map(p => p.id));
  const knownEvidence = new Set(vault.evidence.map(e => e.id));
  const touched = new Set<string>();
  for (const proposal of proposals) {
    const key = proposal.sectionId + ':' + proposal.passageId;
    const section = revised.sections.find(s => s.id === proposal.sectionId);
    const passage = section?.passages.find(p => p.id === proposal.passageId);
    if (!passage) { rejected.push({severity:'blocker',code:'NOT_FOUND',message:'Passage not found',location:key}); continue; }
    if (protectedIds.has(passage.id) || passage.approved) { rejected.push({severity:'blocker',code:'PROTECTED',message:'Approved passage cannot be overwritten',location:key}); continue; }
    if (touched.has(key)) { rejected.push({severity:'blocker',code:'DUPLICATE_EDIT',message:'Multiple edits to one passage',location:key}); continue; }
    if (!proposal.replacement?.trim()) { rejected.push({severity:'blocker',code:'EMPTY_REPLACEMENT',message:'Empty replacement rejected',location:key}); continue; }
    if ((proposal.evidenceIds || []).some(id => !knownEvidence.has(id))) { rejected.push({severity:'blocker',code:'UNKNOWN_CITATION',message:'Proposed citation is not in the evidence ledger',location:key}); continue; }
    touched.add(key);
    const before = passage.text;
    passage.text = proposal.replacement;
    if (proposal.evidenceIds) passage.evidenceIds = [...new Set([...(passage.evidenceIds || []), ...proposal.evidenceIds])];
    changes.push({...proposal, before, after:passage.text});
  }
  return { revised, changes, rejected, audit:auditManuscript(revised), beforeWords:wordCount(vault.original), afterWords:wordCount(revised) };
}

export function buildRepairBrief(vault: RescueVault, targetWords: number): string {
  const original = vault.original;
  const ledger = original.evidence.map(e => ({id:e.id,citation:e.citation,status:e.status,doi:e.doi,page:e.page,sourceUrl:e.sourceUrl}));
  return [
    'FIX MY BOOK — whole-book editorial repair. Return proposed passage edits only, never mutate the original.',
    'Diagnose the complete argument/narrative before revising. Preserve authorial voice, approved passages, structure and original research.',
    'Build a whole-work miniature, then progressively expand and improve across all sections. Do not write one isolated chapter as the product.',
    'Never invent references, quotations, DOIs, page numbers, research findings or verification status. Mark unsupported claims for human review.',
    'Evaluate chronology, repetition, continuity, argument strength, emotional payoff, citations and final DOH errors.',
    'Target words: '+targetWords,
    'Stages: '+JSON.stringify(planProgressiveConstruction(targetWords, wordCount(original))),
    'Evidence ledger: '+JSON.stringify(ledger),
    'Protected passage IDs: '+JSON.stringify(vault.protected.map(p=>p.id)),
    'Sections: '+JSON.stringify(original.sections)
  ].join('\\n\\n');
}

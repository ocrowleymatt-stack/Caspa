import { generateId, writeJsonFile, readJsonFile, listJsonFiles } from '../../shared/fileStore';
import type { ExtractedClaim } from '../research/ClaimExtractor';
import { stubWebResearchProvider } from '../research/StubWebResearchProvider';

export interface VerificationResult {
  claimId: string;
  status: 'unverified' | 'manual_confirmed' | 'disputed';
  evidence: string;
  stubNotice: string;
}

export interface ClaimLedgerEntry {
  id: string;
  projectId?: string;
  claim: ExtractedClaim;
  verification: VerificationResult;
  updatedAt: string;
}

export class VerificationEngine {
  private subPath = 'claim-ledgers';

  verify(claim: ExtractedClaim, projectId?: string): ClaimLedgerEntry {
    const web = stubWebResearchProvider.search(claim.text);
    const entry: ClaimLedgerEntry = {
      id: generateId(),
      projectId,
      claim,
      verification: {
        claimId: claim.id,
        status: 'unverified',
        evidence: web.message,
        stubNotice: 'Automated verification unavailable — confirm manually.',
      },
      updatedAt: new Date().toISOString(),
    };
    return entry;
  }

  async save(entry: ClaimLedgerEntry): Promise<ClaimLedgerEntry> {
    await writeJsonFile(this.subPath, `${entry.id}.json`, entry);
    return entry;
  }

  async confirm(id: string, evidence: string): Promise<ClaimLedgerEntry | null> {
    const entry = await readJsonFile<ClaimLedgerEntry>(this.subPath, `${id}.json`);
    if (!entry) return null;
    entry.verification.status = 'manual_confirmed';
    entry.verification.evidence = evidence;
    entry.updatedAt = new Date().toISOString();
    await writeJsonFile(this.subPath, `${id}.json`, entry);
    return entry;
  }

  async list(projectId?: string): Promise<ClaimLedgerEntry[]> {
    const files = await listJsonFiles(this.subPath);
    const entries: ClaimLedgerEntry[] = [];
    for (const file of files) {
      const e = await readJsonFile<ClaimLedgerEntry>(this.subPath, file);
      if (e && (!projectId || e.projectId === projectId)) entries.push(e);
    }
    return entries;
  }
}

export const verificationEngine = new VerificationEngine();

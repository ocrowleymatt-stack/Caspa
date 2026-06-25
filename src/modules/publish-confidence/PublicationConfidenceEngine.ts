import { qualityCoreOrchestrator } from '../quality-core';
import { verificationEngine } from '../verification/VerificationEngine';
import { claimExtractor } from '../research/ClaimExtractor';
import { generateId, writeJsonFile } from '../../shared/fileStore';
import { getProjectFullText } from '../../shared/elevationHelpers';

export interface ConfidenceCertificate {
  id: string;
  projectId: string;
  overallScore: number;
  status: 'ready' | 'caution' | 'not_ready';
  checks: {
    quality: boolean;
    aiSmell: boolean;
    humanVoice: boolean;
    claimsVerified: boolean;
  };
  recommendations: string[];
  createdAt: string;
}

export class PublicationConfidenceEngine {
  async check(projectId: string): Promise<ConfidenceCertificate> {
    const text = await getProjectFullText(projectId);
    const consolidated = await qualityCoreOrchestrator.consolidatedGate(projectId);
    const claims = claimExtractor.extract(text);
    const claimEntries = claims.map((c) => verificationEngine.verify(c, projectId));
    const verifiedCount = claimEntries.filter((e) => e.verification.status === 'manual_confirmed').length;

    const checks = {
      quality: consolidated.quality.overallScore >= 60,
      aiSmell: consolidated.aiSmell.score >= 50,
      humanVoice: consolidated.humanVoice.score >= 50,
      claimsVerified: claims.length === 0 || verifiedCount / claims.length >= 0.5,
    };

    const passCount = Object.values(checks).filter(Boolean).length;
    const overallScore = Math.round((passCount / 4) * 100 + consolidated.quality.overallScore * 0.25);
    const status = overallScore >= 75 ? 'ready' : overallScore >= 50 ? 'caution' : 'not_ready';

    const recommendations: string[] = [];
    if (!checks.quality) recommendations.push('Run quality gates and address REVISE items');
    if (!checks.aiSmell) recommendations.push('Reduce AI-typical phrasing');
    if (!checks.humanVoice) recommendations.push('Strengthen authentic human voice');
    if (!checks.claimsVerified) recommendations.push('Manually verify factual claims before publishing');

    const certificate: ConfidenceCertificate = {
      id: generateId(),
      projectId,
      overallScore,
      status,
      checks,
      recommendations,
      createdAt: new Date().toISOString(),
    };

    await writeJsonFile('confidence-certificates', `${certificate.id}.json`, certificate);
    return certificate;
  }
}

export const publicationConfidenceEngine = new PublicationConfidenceEngine();

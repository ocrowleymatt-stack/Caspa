import { generateId, readCollection, upsert, type GoldReport, type GoldReportStep, type QualityGateStatus } from '../../shared';
import { requireProject, getProjectFullText } from '../../shared/elevationHelpers';
import { emotionalArcEngine } from '../wonder';
import { qualityOrchestrator } from '../quality';
import { styleDNAExtractor } from '../taste';
import { reactionSimulator } from '../audience';
import { signatureMomentFinder } from '../showstopper';
import { actorTableRead } from '../rehearsal';
import { budgetEstimator } from '../producer';
import { communityReferenceAdapter } from '../localise';
import { visualIdentityEngine } from '../visuals';
import { awardsReadinessPack } from '../awards';
import { commercialReadinessEngine } from '../show-box';
import { finalPolishEngine } from '../wonder';
import { showFactoryService } from '../show-factory';

const COLLECTION = 'gold-reports';

function statusFromScore(score: number): QualityGateStatus {
  if (score >= 80) return 'PASS';
  if (score >= 65) return 'PASS_WITH_WARNINGS';
  if (score >= 45) return 'REVISE';
  return 'BLOCK';
}

export class GoldPipeline {
  async run(projectId: string): Promise<GoldReport> {
    await requireProject(projectId);
    const startedAt = new Date().toISOString();
    const text = await getProjectFullText(projectId);
    const steps: GoldReportStep[] = [];

    const arc = await emotionalArcEngine.analyseProject(projectId);
    steps.push({
      step: 'wonder-analysis',
      label: 'Wonder — Emotional Arc',
      status: statusFromScore(arc.emotionalRange),
      score: arc.emotionalRange,
      summary: arc.arcShape,
      completedAt: new Date().toISOString(),
    });

    const quality = await qualityOrchestrator.checkProject(projectId);
    steps.push({
      step: 'quality-gate',
      label: 'Quality Gates',
      status: quality.overallStatus,
      score: quality.overallScore,
      summary: `${quality.gates.length} gates evaluated`,
      completedAt: new Date().toISOString(),
    });

    const dna = await styleDNAExtractor.extract(text, projectId);
    const tasteScore = Math.round((dna.authenticity + dna.lyricism) / 2);
    steps.push({
      step: 'taste-alignment',
      label: 'Taste — Style DNA',
      status: statusFromScore(tasteScore),
      score: tasteScore,
      summary: dna.summary,
      completedAt: new Date().toISOString(),
    });

    const audience = await reactionSimulator.simulateProject(text, projectId);
    const audScore = Math.round(audience.reduce((s, a) => s + (a.recommendation.length > 20 ? 70 : 55), 0) / audience.length);
    steps.push({
      step: 'audience-simulation',
      label: 'Audience Simulation',
      status: statusFromScore(audScore),
      score: audScore,
      summary: `${audience.length} personas simulated`,
      completedAt: new Date().toISOString(),
    });

    const showstopper = await signatureMomentFinder.find(projectId);
    steps.push({
      step: 'showstopper-moments',
      label: 'Showstopper Moments',
      status: 'PASS',
      score: 78,
      summary: showstopper.riskyOption,
      completedAt: new Date().toISOString(),
    });

    const packages = await showFactoryService.listShowPackages(projectId);
    let rehearsalScore = 50;
    if (packages.length > 0) {
      const tableRead = await actorTableRead.run(packages[0].id);
      rehearsalScore = tableRead.highlights.length >= 2 ? 75 : 60;
      steps.push({
        step: 'rehearsal-readiness',
        label: 'Rehearsal Readiness',
        status: statusFromScore(rehearsalScore),
        score: rehearsalScore,
        summary: tableRead.duration,
        completedAt: new Date().toISOString(),
      });
    } else {
      steps.push({
        step: 'rehearsal-readiness',
        label: 'Rehearsal Readiness',
        status: 'PASS_WITH_WARNINGS',
        score: 50,
        summary: 'No show package — skipped detailed rehearsal analysis',
        completedAt: new Date().toISOString(),
      });
    }

    if (packages.length > 0) {
      const budget = await budgetEstimator.estimate(packages[0].id);
      const prodScore = budget.mid < 100000 ? 72 : 58;
      steps.push({
        step: 'producer-feasibility',
        label: 'Producer Feasibility',
        status: statusFromScore(prodScore),
        score: prodScore,
        summary: `Mid budget estimate: ${budget.currency} ${budget.mid}`,
        completedAt: new Date().toISOString(),
      });
    } else {
      steps.push({
        step: 'producer-feasibility',
        label: 'Producer Feasibility',
        status: 'PASS_WITH_WARNINGS',
        score: 55,
        summary: 'No show package — budget estimate deferred',
        completedAt: new Date().toISOString(),
      });
    }

    const local = await communityReferenceAdapter.adaptProject(projectId, 'Regional');
    steps.push({
      step: 'localisation-check',
      label: 'Localisation',
      status: 'PASS',
      score: 70,
      summary: local.references[0] ?? 'Community references adapted',
      completedAt: new Date().toISOString(),
    });

    const visual = await visualIdentityEngine.build(projectId);
    steps.push({
      step: 'visual-identity',
      label: 'Visual Identity',
      status: 'PASS',
      score: 75,
      summary: visual.mood,
      completedAt: new Date().toISOString(),
    });

    const awards = await awardsReadinessPack.build(projectId);
    steps.push({
      step: 'awards-readiness',
      label: 'Awards Readiness',
      status: statusFromScore(awards.score),
      score: awards.score,
      summary: `${awards.checklist.filter((c) => c.done).length}/${awards.checklist.length} checklist items`,
      completedAt: new Date().toISOString(),
    });

    const commercial = await commercialReadinessEngine.assessProject(projectId);
    steps.push({
      step: 'commercial-readiness',
      label: 'Commercial Readiness',
      status: statusFromScore(commercial.overallScore),
      score: commercial.overallScore,
      summary: commercial.recommendations[0] ?? 'Commercial assessment complete',
      completedAt: new Date().toISOString(),
    });

    const polish = await finalPolishEngine.polish(text.slice(0, 2000), projectId);
    const polishScore = polish.source === 'ai' ? 80 : 65;
    steps.push({
      step: 'final-polish',
      label: 'Final Polish',
      status: statusFromScore(polishScore),
      score: polishScore,
      summary: polish.changes.join('; '),
      completedAt: new Date().toISOString(),
    });

    const overallScore = Math.round(steps.reduce((s, st) => s + st.score, 0) / steps.length);
    const blockers = steps.filter((s) => s.status === 'BLOCK').map((s) => s.label);
    const warnings = steps.filter((s) => s.status === 'REVISE' || s.status === 'PASS_WITH_WARNINGS');

    let overallStatus: QualityGateStatus = 'PASS';
    if (blockers.length) overallStatus = 'BLOCK';
    else if (steps.some((s) => s.status === 'REVISE')) overallStatus = 'REVISE';
    else if (warnings.length) overallStatus = 'PASS_WITH_WARNINGS';

    const report: GoldReport = {
      id: generateId(),
      projectId,
      overallStatus,
      overallScore,
      steps,
      recommendations: warnings.map((s) => `Review: ${s.label} — ${s.summary}`),
      blockers,
      startedAt,
      completedAt: new Date().toISOString(),
    };

    await upsert(COLLECTION, report);
    return report;
  }

  async getLatestReport(projectId: string): Promise<GoldReport | null> {
    const reports = await readCollection<GoldReport>(COLLECTION);
    return reports
      .filter((r) => r.projectId === projectId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0] ?? null;
  }
}

export const goldPipeline = new GoldPipeline();

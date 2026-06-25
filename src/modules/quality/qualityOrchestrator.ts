import { getProjectFullText, requireProject } from '../../shared/elevationHelpers';
import { showFactoryService } from '../show-factory';
import { aggregateScore, aggregateStatus, type QualityCheckResult } from './OutputQualityGate';
import { clicheDetector } from './ClicheDetector';
import { emotionalTruthGate } from './EmotionalTruthGate';
import { rightsAndSafetyGate } from './RightsAndSafetyGate';
import { commercialClarityGate } from './CommercialClarityGate';
import { performancePracticalityGate } from './PerformancePracticalityGate';

export class QualityOrchestrator {
  checkText(text: string): QualityCheckResult {
    const gates = [
      clicheDetector.check(text),
      emotionalTruthGate.check(text),
      rightsAndSafetyGate.check(text),
      commercialClarityGate.check(text),
      performancePracticalityGate.check(text),
    ];
    return {
      overallStatus: aggregateStatus(gates),
      overallScore: aggregateScore(gates),
      gates,
      generatedAt: new Date().toISOString(),
    };
  }

  async checkProject(projectId: string): Promise<QualityCheckResult> {
    const text = await getProjectFullText(projectId);
    return this.checkText(text);
  }

  async checkShow(showPackageId: string): Promise<QualityCheckResult> {
    const pkg = await showFactoryService.getShowPackage(showPackageId);
    const text = `${pkg.title}\nType: ${pkg.type}\nComponents: ${pkg.components.join(', ')}`;
    return this.checkText(text);
  }

  async checkMarketing(text: string): Promise<QualityCheckResult> {
    const result = this.checkText(text);
    result.gates = result.gates.filter((g) =>
      ['ClicheDetector', 'CommercialClarityGate', 'RightsAndSafetyGate'].includes(g.gate),
    );
    result.overallStatus = aggregateStatus(result.gates);
    result.overallScore = aggregateScore(result.gates);
    return result;
  }

  async finalGate(projectId: string): Promise<QualityCheckResult> {
    await requireProject(projectId);
    const result = await this.checkProject(projectId);
    if (result.overallScore < 60) {
      result.overallStatus = 'REVISE';
    }
    return result;
  }
}

export const qualityOrchestrator = new QualityOrchestrator();

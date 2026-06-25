import { qualityOrchestrator } from '../quality/qualityOrchestrator';
import { aiSmellDetector } from './AISmellDetector';
import { humanVoiceEngine } from './HumanVoiceEngine';
import { getProjectFullText } from '../../shared/elevationHelpers';

export class QualityCoreOrchestrator {
  async aiSmell(text?: string, projectId?: string) {
    const content = text ?? (projectId ? await getProjectFullText(projectId) : '');
    if (!content.trim()) throw new Error('text or projectId is required');
    return aiSmellDetector.detect(content);
  }

  async humanVoice(text?: string, projectId?: string) {
    const content = text ?? (projectId ? await getProjectFullText(projectId) : '');
    if (!content.trim()) throw new Error('text or projectId is required');
    return humanVoiceEngine.assess(content, projectId);
  }

  async consolidatedGate(projectId: string) {
    const text = await getProjectFullText(projectId);
    const [quality, smell, voice] = await Promise.all([
      qualityOrchestrator.checkProject(projectId),
      aiSmellDetector.detect(text),
      humanVoiceEngine.assess(text, projectId),
    ]);
    return {
      quality,
      aiSmell: smell,
      humanVoice: voice,
      overallReady: quality.overallScore >= 60 && smell.score >= 50 && voice.score >= 50,
    };
  }
}

export const qualityCoreOrchestrator = new QualityCoreOrchestrator();

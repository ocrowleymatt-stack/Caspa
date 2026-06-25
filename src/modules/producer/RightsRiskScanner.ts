import { getProjectFullText, requireProject } from '../../shared/elevationHelpers';

export interface RightsRiskReport {
  projectId: string;
  riskLevel: 'low' | 'medium' | 'high';
  flags: string[];
  recommendations: string[];
  generatedAt: string;
}

export class RightsRiskScanner {
  async scan(projectId: string): Promise<RightsRiskReport> {
    const text = await getProjectFullText(projectId);
    const flags: string[] = [];
    if (/\b(real name|celebrity|brand)\b/i.test(text)) flags.push('Possible real-person references');
    if (/\b(song lyrics|copyright)\b/i.test(text)) flags.push('Check quoted lyrics permissions');
    if (text.length > 100000) flags.push('Extended adaptation rights may be needed');

    const riskLevel = flags.length >= 2 ? 'high' : flags.length === 1 ? 'medium' : 'low';

    return {
      projectId,
      riskLevel,
      flags,
      recommendations: flags.length
        ? ['Legal review recommended before adaptation', 'Document all third-party references']
        : ['No major rights flags detected'],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const rightsRiskScanner = new RightsRiskScanner();

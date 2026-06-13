/**
 * Caspa Cost & Time Estimator
 * Calculates processing costs and read time based on document properties
 */

interface EstimateParams {
  wordCount: number;
  format: 'screen' | 'professional';
  includeIllustrations: boolean;
  illustrationCount?: number;
  documentType?: 'fiction' | 'training' | 'manual' | 'other';
}

interface CostEstimate {
  baseCost: number;
  illustrationCost: number;
  illustrationCount: number;
  totalCost: number;
  processingTimeSeconds: number;
  estimatedReadTimeMinutes: number;
  breakdown: {
    label: string;
    cost: number;
  }[];
}

export class CostEstimatorService {
  private readonly BASE_RATE_PER_1K = 0.01; // $0.01 per 1000 words
  private readonly PROFESSIONAL_MULTIPLIER = 2; // 2x for print-ready
  private readonly ILLUSTRATION_RATE = 1.8; // ~£1.80 per Grok Imagine
  private readonly PROCESSING_TIME_PER_WORD = 0.002; // 2ms per word

  estimateCost(params: EstimateParams): CostEstimate {
    const baseRate = params.format === 'professional' 
      ? this.BASE_RATE_PER_1K * this.PROFESSIONAL_MULTIPLIER 
      : this.BASE_RATE_PER_1K;

    // Base document cost
    const baseCost = (params.wordCount / 1000) * baseRate;

    // Illustration cost
    let illustrationCount = params.illustrationCount || this._estimateIllustrationCount(params.wordCount, params.documentType || 'other');
    const illustrationCost = params.includeIllustrations 
      ? illustrationCount * (this.ILLUSTRATION_RATE / 100) // Convert GBP to USD approx
      : 0;

    const totalCost = baseCost + illustrationCost;

    // Processing time: base + illustration rendering
    const baseProcessingTime = params.wordCount * this.PROCESSING_TIME_PER_WORD;
    const illustrationTime = params.includeIllustrations ? illustrationCount * 15 : 0; // 15s per illustration
    const processingTimeSeconds = Math.round(baseProcessingTime + illustrationTime);

    // Reading time (avg 200 words/min)
    const estimatedReadTimeMinutes = Math.ceil(params.wordCount / 200);

    return {
      baseCost: Math.round(baseCost * 100) / 100,
      illustrationCost: Math.round(illustrationCost * 100) / 100,
      illustrationCount,
      totalCost: Math.round(totalCost * 100) / 100,
      processingTimeSeconds,
      estimatedReadTimeMinutes,
      breakdown: [
        { label: 'Document processing', cost: baseCost },
        ...(params.includeIllustrations ? [{ label: `Illustrations (${illustrationCount})`, cost: illustrationCost }] : []),
      ],
    };
  }

  private _estimateIllustrationCount(wordCount: number, docType: string): number {
    // Different doc types have different illustration needs
    const counts: { [key: string]: number } = {
      'fiction': Math.ceil(wordCount / 2500), // 1 per 2500 words
      'training': Math.ceil(wordCount / 1500), // 1 per 1500 words
      'manual': Math.ceil(wordCount / 1000),   // 1 per 1000 words
      'other': Math.ceil(wordCount / 3000),    // 1 per 3000 words
    };
    return Math.max(0, Math.min(counts[docType] || counts['other'], 30)); // Cap at 30 illustrations
  }
}

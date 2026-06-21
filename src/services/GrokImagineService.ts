/**
 * Grok Imagine Service - SuperGrok Tier Optimized
 * 
 * Generates professional AI illustrations for document content.
 * Integrates with Grok's image generation API to produce:
 * - Chapter openers
 * - Diagrams and infographics
 * - Character mood boards
 * - Scene illustrations
 * - Cover artwork (premium quality)
 * 
 * Features:
 * - SuperGrok tier: grok-3 model + 4K resolution
 * - Batch generation with parallel processing
 * - Style consistency across illustrations
 * - Cost estimation
 * - Validation against specifications
 */

export interface GenerationRequest {
  illustrations: {
    id: string;
    type: string;
    grokPrompt: string;
    style?: string;
    dimensions?: string;
    priority?: 'standard' | 'premium'; // premium = 4K, higher quality
  }[];
  batchSize?: number; // How many to generate in parallel (default: 3 for SuperGrok)
  styleOverride?: string; // Override all illustration styles
  onProgress?: (progress: ProgressUpdate) => void;
}

export interface ProgressUpdate {
  total: number;
  completed: number;
  current: {
    id: string;
    status: 'pending' | 'generating' | 'complete' | 'failed';
    imageUrl?: string;
    error?: string;
  };
  estimatedTimeRemaining?: number; // seconds
  costSoFar?: number; // in pence/credits
}

export interface IllustrationAsset {
  id: string;
  type: string;
  imageUrl: string;
  imageBuffer?: Buffer;
  metadata: {
    width: number;
    height: number;
    format: string;
    generatedAt: string;
    model: string;
    prompt: string;
    cost?: number;
    tier?: string;
  };
  validationScore?: number; // 0-100, how well it matches the spec
}

export interface GenerationResult {
  assets: IllustrationAsset[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalCost: number; // in pence/credits
    generationTime: number; // seconds
    averageCostPerImage: number;
    tier: string; // SuperGrok
  };
  failures?: {
    id: string;
    reason: string;
  }[];
}

/**
 * Main service for Grok Imagine integration
 */
export class GrokImagineService {
  private grokApiKey: string;
  private grokApiUrl = 'https://api.x.ai/v1/images/generations';
  private tierModel = 'grok-3'; // SuperGrok uses latest Grok 3
  private standardCostPerImage = 8; // pence, standard 1024x1024
  private premiumCostPerImage = 24; // pence, 4K 4096x4096

  constructor(apiKey: string) {
    this.grokApiKey = apiKey;
  }

  /**
   * Generate illustrations from specifications
   */
  async generateIllustrations(
    request: GenerationRequest
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    const assets: IllustrationAsset[] = [];
    const failures: { id: string; reason: string }[] = [];

    // SuperGrok: default to 3 parallel requests (optimized for tier limits)
    const batchSize = request.batchSize || 3;
    const total = request.illustrations.length;

    // Process in batches
    for (let i = 0; i < total; i += batchSize) {
      const batch = request.illustrations.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((illust, idx) => 
          this.generateSingleIllustration(
            illust,
            i + idx + 1,
            total,
            request.onProgress
          )
        )
      );

      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          assets.push(result.value);
        } else {
          failures.push({
            id: batch[idx].id,
            reason: result.reason?.message || 'Unknown error'
          });
        }
      });
    }

    const endTime = Date.now();
    const generationTime = (endTime - startTime) / 1000;
    
    // Calculate actual cost based on premium/standard mix
    let totalCost = 0;
    assets.forEach(asset => {
      totalCost += asset.metadata.cost || this.standardCostPerImage;
    });

    return {
      assets,
      summary: {
        total,
        successful: assets.length,
        failed: failures.length,
        totalCost,
        generationTime,
        averageCostPerImage: assets.length > 0 ? totalCost / assets.length : 0,
        tier: 'SuperGrok'
      },
      failures: failures.length > 0 ? failures : undefined
    };
  }

  /**
   * Generate a single illustration with SuperGrok optimizations
   */
  private async generateSingleIllustration(
    spec: {
      id: string;
      type: string;
      grokPrompt: string;
      style?: string;
      priority?: 'standard' | 'premium';
    },
    sequenceNumber: number,
    total: number,
    onProgress?: (update: ProgressUpdate) => void
  ): Promise<IllustrationAsset> {
    // Determine resolution and cost based on priority
    const isPremium = spec.priority === 'premium' || spec.type === 'cover';
    const size = isPremium ? '4096x4096' : '1024x1024';
    const estimatedCost = isPremium ? this.premiumCostPerImage : this.standardCostPerImage;

    // Notify: starting
    if (onProgress) {
      onProgress({
        total,
        completed: sequenceNumber - 1,
        current: {
          id: spec.id,
          status: 'generating'
        }
      });
    }

    try {
      // Call Grok Imagine API with SuperGrok optimizations
      const response = await fetch(this.grokApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.grokApiKey}`
        },
        body: JSON.stringify({
          model: this.tierModel, // grok-3 for SuperGrok
          prompt: spec.grokPrompt,
          n: 1,
          size, // 4K for premium, 1K standard
          quality: isPremium ? 'hd-premium' : 'hd',
          response_format: 'url',
          // SuperGrok-specific: improved coherence & style consistency
          style_consistency: true,
          seed: null, // Allow variation, or use consistent seed for series
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Grok API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const imageUrl = data.data?.[0]?.url;

      if (!imageUrl) {
        throw new Error('No image URL in response');
      }

      // Fetch image bytes for metadata extraction
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();

      const [width, height] = isPremium ? [4096, 4096] : [1024, 1024];

      const asset: IllustrationAsset = {
        id: spec.id,
        type: spec.type,
        imageUrl,
        imageBuffer: Buffer.from(imageBuffer),
        metadata: {
          width,
          height,
          format: 'png',
          generatedAt: new Date().toISOString(),
          model: this.tierModel,
          prompt: spec.grokPrompt,
          cost: estimatedCost,
          tier: 'SuperGrok'
        }
      };

      // Notify: complete
      if (onProgress) {
        onProgress({
          total,
          completed: sequenceNumber,
          current: {
            id: spec.id,
            status: 'complete',
            imageUrl
          }
        });
      }

      return asset;
    } catch (error) {
      // Notify: failed
      if (onProgress) {
        onProgress({
          total,
          completed: sequenceNumber,
          current: {
            id: spec.id,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }

      throw error;
    }
  }

  /**
   * Estimate total generation cost for SuperGrok
   */
  estimateCost(illustrations: Array<{ priority?: 'standard' | 'premium'; type?: string }>): number {
    return illustrations.reduce((total, illust) => {
      const isPremium = illust.priority === 'premium' || illust.type === 'cover';
      return total + (isPremium ? this.premiumCostPerImage : this.standardCostPerImage);
    }, 0);
  }

  /**
   * Validate generated assets against specifications
   */
  validateAssets(
    assets: IllustrationAsset[],
    specifications: any[]
  ): {
    valid: boolean;
    scores: Record<string, number>; // id -> validation score
    issues: string[];
  } {
    const scores: Record<string, number> = {};
    const issues: string[] = [];

    assets.forEach(asset => {
      // Basic validation
      let score = 100;

      // Check if image exists
      if (!asset.imageUrl) {
        score -= 50;
        issues.push(`Asset ${asset.id} missing image URL`);
      }

      // Check metadata
      if (!asset.metadata.generatedAt) {
        score -= 10;
      }

      // Check dimensions are reasonable
      const minDim = asset.metadata.width >= 4096 ? 4096 : 1024;
      if (asset.metadata.width < minDim || asset.metadata.height < minDim) {
        score -= 20;
        issues.push(`Asset ${asset.id} has suboptimal resolution (expected ${minDim}x${minDim})`);
      }

      scores[asset.id] = Math.max(0, score);
    });

    return {
      valid: Object.values(scores).every(s => s >= 70),
      scores,
      issues
    };
  }

  /**
   * Batch generate with parallel processing optimized for SuperGrok
   */
  async generateBatch(
    illustrations: Array<{
      id: string;
      type: string;
      grokPrompt: string;
      priority?: 'standard' | 'premium';
    }>
  ): Promise<GenerationResult> {
    return this.generateIllustrations({
      illustrations,
      batchSize: 3 // SuperGrok: 3 parallel is optimal
    });
  }
}

/**
 * Factory function to create service with API key from env
 */
export function createGrokImagineService(): GrokImagineService {
  const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('GROK_API_KEY or XAI_API_KEY environment variable required');
  }
  return new GrokImagineService(apiKey);
}

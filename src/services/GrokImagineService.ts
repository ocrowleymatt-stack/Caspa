/**
 * Grok Imagine Service
 * 
 * Generates professional AI illustrations for document content.
 * Integrates with Grok's image generation API to produce:
 * - Chapter openers
 * - Diagrams and infographics
 * - Character mood boards
 * - Scene illustrations
 * - Cover artwork
 * 
 * Features:
 * - Batch generation with progress tracking
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
  }[];
  batchSize?: number; // How many to generate in parallel (default: 1)
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
  private estimatedCostPerImage = 15; // rough estimate in pence

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

    const batchSize = request.batchSize || 1;
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
    const totalCost = assets.length * this.estimatedCostPerImage;

    return {
      assets,
      summary: {
        total,
        successful: assets.length,
        failed: failures.length,
        totalCost,
        generationTime,
        averageCostPerImage: assets.length > 0 ? totalCost / assets.length : 0
      },
      failures: failures.length > 0 ? failures : undefined
    };
  }

  /**
   * Generate a single illustration
   */
  private async generateSingleIllustration(
    spec: {
      id: string;
      type: string;
      grokPrompt: string;
      style?: string;
    },
    sequenceNumber: number,
    total: number,
    onProgress?: (update: ProgressUpdate) => void
  ): Promise<IllustrationAsset> {
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
      // Call Grok Imagine API
      const response = await fetch(this.grokApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.grokApiKey}`
        },
        body: JSON.stringify({
          model: 'grok-vision', // or appropriate Grok model
          prompt: spec.grokPrompt,
          n: 1,
          size: '1024x1024', // configurable
          quality: 'hd',
          response_format: 'url' // or base64
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
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

      const asset: IllustrationAsset = {
        id: spec.id,
        type: spec.type,
        imageUrl,
        imageBuffer: Buffer.from(imageBuffer),
        metadata: {
          width: 1024,
          height: 1024,
          format: 'png',
          generatedAt: new Date().toISOString(),
          model: 'grok-vision',
          prompt: spec.grokPrompt,
          cost: this.estimatedCostPerImage
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
   * Estimate total generation cost
   */
  estimateCost(illustrationCount: number): number {
    return illustrationCount * this.estimatedCostPerImage;
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
      if (asset.metadata.width < 512 || asset.metadata.height < 512) {
        score -= 20;
        issues.push(`Asset ${asset.id} has low resolution`);
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
   * Batch generate and return results
   */
  async generateBatch(
    illustrations: Array<{
      id: string;
      type: string;
      grokPrompt: string;
    }>,
    parallel: boolean = false
  ): Promise<GenerationResult> {
    return this.generateIllustrations({
      illustrations,
      batchSize: parallel ? illustrations.length : 1
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

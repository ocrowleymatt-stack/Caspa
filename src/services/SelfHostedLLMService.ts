/**
 * Self-Hosted LLM Service
 * Integrates with local Ollama for creative writing tasks
 * Fallback to cloud APIs for non-essential operations
 */

export interface LLMRequest {
  prompt: string;
  model?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  context?: string;
}

export interface LLMResponse {
  text: string;
  model: string;
  timestamp: number;
  tokensUsed?: number;
  source: 'ollama' | 'gemini' | 'openai';
}

class SelfHostedLLMService {
  private ollamaBase = 'http://localhost:11434/api';
  private defaultModel = 'mistral'; // Fast, multi-lingual
  private creativeModel = 'neural-chat'; // Better for creative writing
  private timeout = 60000;

  async isOllamaAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaBase}/tags`, { 
        timeout: 5000 
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.ollamaBase}/tags`);
      const data = await response.json() as { models: Array<{ name: string }> };
      return data.models?.map(m => m.name) || [];
    } catch {
      return [];
    }
  }

  /**
   * Generate creative content using self-hosted LLM
   * Best for: Character backstories, scene descriptions, plot suggestions
   */
  async generateCreative(request: LLMRequest): Promise<LLMResponse> {
    const isAvailable = await this.isOllamaAvailable();
    
    if (!isAvailable) {
      return this.fallbackToCloud(request);
    }

    try {
      const model = request.model || this.creativeModel;
      const systemPrompt = `You are a world-class literary fiction author with expertise in character psychology, narrative structure, and emotional authenticity. Your writing is prize-calibre, with invisible complexity and profound human insight. Keep responses concise, powerful, and original.`;

      const response = await fetch(`${this.ollamaBase}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: request.prompt,
          system: systemPrompt,
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 500,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const data = await response.json() as { 
        response: string; 
        model: string; 
        eval_count?: number;
        prompt_eval_count?: number;
      };

      return {
        text: data.response.trim(),
        model: data.model,
        timestamp: Date.now(),
        tokensUsed: (data.eval_count ?? 0) + (data.prompt_eval_count ?? 0),
        source: 'ollama',
      };
    } catch (error) {
      console.error('Self-hosted LLM error:', error);
      return this.fallbackToCloud(request);
    }
  }

  /**
   * Quick analysis/classification using lightweight model
   * Best for: Issue detection, character consistency checks, tone analysis
   */
  async analyzeQuick(
    text: string,
    analysisType: 'tone' | 'consistency' | 'pacing' | 'emotion'
  ): Promise<string> {
    const isAvailable = await this.isOllamaAvailable();
    
    if (!isAvailable) {
      return `Unable to analyze (cloud fallback needed for: ${analysisType})`;
    }

    try {
      const prompts = {
        tone: `Analyze the tone in 1-2 sentences: "${text.slice(0, 500)}"`,
        consistency: `Check character consistency in 1 sentence: "${text.slice(0, 500)}"`,
        pacing: `Analyze pacing speed (fast/medium/slow) in 1 sentence: "${text.slice(0, 500)}"`,
        emotion: `What is the dominant emotion in 1 sentence: "${text.slice(0, 500)}"`,
      };

      const response = await fetch(`${this.ollamaBase}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.defaultModel,
          prompt: prompts[analysisType],
          temperature: 0.3,
          num_predict: 100,
          stream: false,
        }),
      });

      if (!response.ok) return `Analysis unavailable`;

      const data = await response.json() as { response: string };
      return data.response.trim();
    } catch {
      return `Analysis unavailable (local LLM offline)`;
    }
  }

  /**
   * Streaming generation for real-time UI updates
   * Best for: Live drafting, real-time suggestions
   */
  async *generateStreaming(request: LLMRequest): AsyncGenerator<string> {
    const isAvailable = await this.isOllamaAvailable();
    
    if (!isAvailable) {
      // Fallback: yield single response
      const response = await this.fallbackToCloud(request);
      yield response.text;
      return;
    }

    try {
      const model = request.model || this.creativeModel;
      const response = await fetch(`${this.ollamaBase}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: request.prompt,
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 500,
          stream: true,
        }),
      });

      if (!response.ok) throw new Error('Streaming failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            const chunk = JSON.parse(line) as { response?: string };
            if (chunk.response) yield chunk.response;
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      const fallback = await this.fallbackToCloud(request);
      yield fallback.text;
    }
  }

  /**
   * Fallback to cloud APIs for non-essential features
   */
  private async fallbackToCloud(request: LLMRequest): Promise<LLMResponse> {
    // This would call your existing Gemini/OpenAI integrations
    // For now, return a placeholder
    return {
      text: `[Cloud LLM would process: "${request.prompt.slice(0, 50)}..."]`,
      model: request.model || 'cloud-fallback',
      timestamp: Date.now(),
      source: 'gemini',
    };
  }
}

export const selfHostedLLM = new SelfHostedLLMService();

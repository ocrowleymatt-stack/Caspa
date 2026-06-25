export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  route: string;
  method: 'GET' | 'POST';
  module: string;
  category: string;
}

const TOOLS: ToolDefinition[] = [
  { id: 'quality-check-text', name: 'Check Text Quality', description: 'Run quality gates on text', route: '/api/quality/check-text', method: 'POST', module: 'quality', category: 'quality' },
  { id: 'quality-ai-smell', name: 'AI Smell Detector', description: 'Detect AI-generated patterns', route: '/api/quality/ai-smell', method: 'POST', module: 'quality-core', category: 'quality' },
  { id: 'quality-final-gate', name: 'Final Quality Gate', description: 'Final publish readiness gate', route: '/api/quality/final-gate', method: 'POST', module: 'quality', category: 'quality' },
  { id: 'intake-analyse', name: 'Analyse Intake', description: 'Classify and interpret source material', route: '/api/intake/analyse', method: 'POST', module: 'intake', category: 'intake' },
  { id: 'product-recommend', name: 'Recommend Product', description: 'Recommend product formats', route: '/api/product-forge/recommend', method: 'POST', module: 'product-forge', category: 'forge' },
  { id: 'music-interpret', name: 'Interpret Music Prompt', description: 'Parse natural language music intent', route: '/api/music-prompt/interpret', method: 'POST', module: 'music-prompt-lab', category: 'music' },
  { id: 'music-jam-start', name: 'Start Jam Session', description: 'Begin collaborative jam session', route: '/api/music-prompt/jam/start', method: 'POST', module: 'music-prompt-lab', category: 'music' },
  { id: 'document-preview', name: 'Document Preview', description: 'Render HTML/Markdown preview', route: '/api/document-render/preview', method: 'POST', module: 'document-renderer', category: 'documents' },
  { id: 'publish-confidence', name: 'Publish Confidence', description: 'Check publication readiness', route: '/api/publish-confidence/check', method: 'POST', module: 'publish-confidence', category: 'publish' },
  { id: 'research-plan', name: 'Research Plan', description: 'Plan research tasks', route: '/api/research/plan', method: 'POST', module: 'research', category: 'research' },
  { id: 'verification-verify', name: 'Verify Claims', description: 'Verify extracted claims', route: '/api/verification/verify', method: 'POST', module: 'verification', category: 'research' },
  { id: 'wonder-polish', name: 'Wonder Polish', description: 'Final polish via Wonder engine', route: '/api/wonder/polish', method: 'POST', module: 'wonder', category: 'elevation' },
  { id: 'casper-freestyle', name: 'Casper Freestyle', description: 'Natural language command session', route: '/api/casper/freestyle', method: 'POST', module: 'casper-freestyle', category: 'command' },
  { id: 'show-factory-pack', name: 'Show Package', description: 'Create show package', route: '/api/show-factory/packages', method: 'POST', module: 'show-factory', category: 'production' },
  { id: 'publish-epub', name: 'Build EPUB', description: 'Generate EPUB export', route: '/api/publish/epub', method: 'POST', module: 'publishing', category: 'publish' },
];

export class ToolRegistry {
  listTools(category?: string): ToolDefinition[] {
    if (!category) return [...TOOLS];
    return TOOLS.filter((t) => t.category === category);
  }

  getTool(id: string): ToolDefinition | null {
    return TOOLS.find((t) => t.id === id) ?? null;
  }

  toolsForIntent(intent: string): ToolDefinition[] {
    const map: Record<string, string[]> = {
      quality_check: ['quality-check-text', 'quality-ai-smell', 'quality-final-gate', 'wonder-polish'],
      publish: ['publish-confidence', 'publish-epub', 'quality-final-gate'],
      music: ['music-interpret', 'music-jam-start'],
      research: ['research-plan', 'verification-verify'],
      intake: ['intake-analyse'],
      product_plan: ['product-recommend'],
      document: ['document-preview'],
      workflow: ['quality-final-gate', 'publish-confidence', 'document-preview'],
      unknown: ['casper-freestyle'],
    };
    const ids = map[intent] ?? map.unknown;
    return ids.map((id) => this.getTool(id)).filter((t): t is ToolDefinition => t !== null);
  }
}

export const toolRegistry = new ToolRegistry();

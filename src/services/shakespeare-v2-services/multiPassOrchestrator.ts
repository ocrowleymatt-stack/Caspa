/**
 * Multi-Pass Orchestrator Service
 * Manages the 5-stage iterative refinement pipeline
 * Word count discipline: 50% → 75% → 85% → 95% → final cut
 */

import { getFirestore, collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';

export interface PassConfig {
  passNumber: 1 | 2 | 3 | 4 | 5;
  targetWordCountPercent: number; // 50, 75, 85, 95, 100
  focus: string; // What this pass emphasizes
  instructions: string; // AI prompt instructions
  minWordCount?: number;
  maxWordCount?: number;
}

export interface PassResult {
  id?: string;
  projectId: string;
  passNumber: 1 | 2 | 3 | 4 | 5;
  timestamp: number;
  originalWordCount: number;
  resultWordCount: number;
  manuscript: string;
  summary: string; // AI-generated summary of changes
  characterArcsUpdated: string[]; // character IDs updated in this pass
  researchIntegrated: string[]; // research entry IDs integrated
  qualityScore: number; // 0-100
  notes: string;
}

const PASS_CONFIGS: Record<number, PassConfig> = {
  1: {
    passNumber: 1,
    targetWordCountPercent: 50,
    focus: 'Story Spine & Foundation',
    instructions: `You are building the structural foundation (pier foundation).

Current draft word count target: 50% of final length.

Focus on:
- Establish the premise clearly
- Introduce protagonist and inciting incident
- Set up main conflict
- Plant character seeds and motivations
- Keep prose tight, every sentence earns its place
- 0 filler, pure narrative momentum

Remove anything that isn't essential to the core story.
Trim descriptions, compress dialogue, cut subplots.

Output only the refined manuscript.`,
  },
  2: {
    passNumber: 2,
    targetWordCountPercent: 75,
    focus: 'Character Depth & World',
    instructions: `You are extending the pier (building outward).

Current draft word count target: 75% of final length.

Focus on:
- Deepen character backstory and motivations
- Enrich dialogue with personality and voice
- Build world details (setting, culture, rules)
- Add texture through sensory details
- Strengthen character relationships and conflicts
- Develop secondary characters
- Maintain pacing and tension

Add necessary depth without filler. Every addition must serve character or world.
Reference character library traits and research library facts.

Output only the refined manuscript.`,
  },
  3: {
    passNumber: 3,
    targetWordCountPercent: 85,
    focus: 'Psychological Influence & Emotion',
    instructions: `You are deepening the pier (adding psychological architecture).

Current draft word count target: 85% of final length.

Focus on:
- Integrate psychological influence techniques
- Deepen reader emotional investment
- Add moral complexity and ambiguity
- Show character vulnerability and growth
- Build belief-shifting moments
- Use silence and pause strategically
- Add internal conflict and inner monologue

Make readers FEEL the story. Use character secrets and fears to shift beliefs.
Reference psychological influence library.

Output only the refined manuscript.`,
  },
  4: {
    passNumber: 4,
    targetWordCountPercent: 95,
    focus: 'Polish & Precision',
    instructions: `You are polishing (final preparation before editing).

Current draft word count target: 95% of final length.

Focus on:
- Perfect prose style and voice consistency
- Eliminate clichés and weak expressions
- Tighten sentences (active voice, strong verbs)
- Fix continuity and timeline issues
- Verify research accuracy (check against research library)
- Ensure character consistency (check against character library)
- Add final sensory details and atmosphere

This is your last chance before the editor.
Make it pristine. Make it beautiful.

Output only the refined manuscript.`,
  },
  5: {
    passNumber: 5,
    targetWordCountPercent: 100,
    focus: 'Mrs. Parry Ruthless Edit',
    instructions: `You are Mrs. Parry, the ruthless editor from hell.

You will cut 25-40% of this draft.
You show NO MERCY. Red pen everywhere.

Focus on:
- DELETE anything that doesn't serve the core story
- Cut verbose descriptions (show, don't tell)
- Eliminate repetition and redundancy
- Remove subplot bloat
- Delete weak dialogue
- Cut backstory that doesn't change anything
- Trim scene endings and openings to bare necessity

Your goal: Create a lean, powerful, prize-winning manuscript.
Every remaining word earns its place or dies.

Output only the final, brutal manuscript.`,
  },
};

class MultiPassOrchestrator {
  private db: any;
  private projectId: string = '';

  constructor() {
    this.db = getFirestore();
  }

  setProjectId(projectId: string) {
    this.projectId = projectId;
  }

  getPassConfig(passNumber: 1 | 2 | 3 | 4 | 5): PassConfig {
    return PASS_CONFIGS[passNumber];
  }

  /**
   * Run a single pass
   */
  async runPass(
    passNumber: 1 | 2 | 3 | 4 | 5,
    currentManuscript: string,
    targetWordCount: number,
    aiService: any,
    characterSummary?: string,
    researchSummary?: string
  ): Promise<PassResult> {
    if (!this.projectId) throw new Error('Project ID not set');

    const config = this.getPassConfig(passNumber);
    const currentWordCount = this.countWords(currentManuscript);
    const targetWords = Math.round((targetWordCount * config.targetWordCountPercent) / 100);

    let instructions = config.instructions;

    // Add context if available
    if (characterSummary) {
      instructions += `\n\nCharacter Library Reference:\n${characterSummary}`;
    }
    if (researchSummary) {
      instructions += `\n\nResearch Library Reference:\n${researchSummary}`;
    }

    instructions += `\n\nTarget word count for this pass: ${targetWords} words (currently ${currentWordCount} words).`;

    const prompt = `${instructions}\n\n---\n\nManuscript to refine:\n\n${currentManuscript}`;

    console.log(`Running Pass ${passNumber}: ${config.focus} (targeting ${targetWords} words)`);

    try {
      const response = await aiService.generateContent(prompt);
      const refinedManuscript = response.response.text();
      const resultWordCount = this.countWords(refinedManuscript);

      const passResult: PassResult = {
        projectId: this.projectId,
        passNumber,
        timestamp: Date.now(),
        originalWordCount: currentWordCount,
        resultWordCount,
        manuscript: refinedManuscript,
        summary: await this.generatePassSummary(config, currentWordCount, resultWordCount),
        characterArcsUpdated: [],
        researchIntegrated: [],
        qualityScore: this.estimateQualityScore(passNumber, resultWordCount, targetWords),
        notes: `${config.focus} - Word count: ${currentWordCount} → ${resultWordCount}`,
      };

      // Save pass result to Firestore
      const docRef = await addDoc(collection(this.db, 'passes'), passResult);
      passResult.id = docRef.id;

      return passResult;
    } catch (error) {
      console.error(`Pass ${passNumber} failed:`, error);
      throw new Error(`Failed to run pass ${passNumber}`);
    }
  }

  /**
   * Run complete multi-pass pipeline
   */
  async runCompletePipeline(
    initialManuscript: string,
    targetWordCount: number,
    aiService: any,
    onPassComplete?: (result: PassResult) => void
  ): Promise<PassResult[]> {
    if (!this.projectId) throw new Error('Project ID not set');

    const results: PassResult[] = [];
    let currentManuscript = initialManuscript;

    for (let pass = 1; pass <= 5; pass++) {
      const result = await this.runPass(pass as 1 | 2 | 3 | 4 | 5, currentManuscript, targetWordCount, aiService);
      results.push(result);
      currentManuscript = result.manuscript;

      if (onPassComplete) {
        onPassComplete(result);
      }

      // Add delay between passes to avoid rate limiting
      if (pass < 5) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  /**
   * Get all passes for a project
   */
  async getProjectPasses(projectId: string): Promise<PassResult[]> {
    const q = query(collection(this.db, 'passes'), where('projectId', '==', projectId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PassResult)).sort((a, b) => a.passNumber - b.passNumber);
  }

  /**
   * Get a specific pass
   */
  async getPass(passId: string): Promise<PassResult> {
    const docRef = doc(this.db, 'passes', passId);
    const snapshot = await getDocs(query(collection(this.db, 'passes'), where('id', '==', passId)));
    if (snapshot.empty) throw new Error('Pass not found');
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PassResult;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  /**
   * Generate a summary of what changed in this pass
   */
  private async generatePassSummary(config: PassConfig, originalWordCount: number, resultWordCount: number): Promise<string> {
    const delta = resultWordCount - originalWordCount;
    const deltaPercent = ((delta / originalWordCount) * 100).toFixed(1);
    const direction = delta > 0 ? 'expanded' : 'reduced';

    return `${config.focus}: ${direction} from ${originalWordCount} to ${resultWordCount} words (${deltaPercent}%)`;
  }

  /**
   * Estimate quality score (0-100)
   * Heuristic: how close to target word count, pass number, etc.
   */
  private estimateQualityScore(passNumber: number, resultWordCount: number, targetWords: number): number {
    const targetConfig = PASS_CONFIGS[passNumber];
    const percent = targetConfig.targetWordCountPercent;

    // Closer to target = higher score
    // Later passes worth more
    const wordDelta = Math.abs(resultWordCount - targetWords);
    const wordScore = Math.max(0, 100 - (wordDelta / targetWords) * 50);
    const passBonus = passNumber * 5;

    return Math.min(100, wordScore + passBonus);
  }

  /**
   * Compare two manuscript versions
   */
  compareVersions(v1: string, v2: string): { wordsAdded: number; wordsRemoved: number; similarity: number } {
    const w1 = v1.split(/\s+/);
    const w2 = v2.split(/\s+/);

    // Simple diff: count unique words in each
    const set1 = new Set(w1);
    const set2 = new Set(w2);

    const added = w2.length - w1.length;
    const removed = w1.length - w2.length;
    const intersection = [...set1].filter(word => set2.has(word)).length;
    const union = set1.size + set2.size - intersection;
    const similarity = union > 0 ? (intersection / union) * 100 : 0;

    return {
      wordsAdded: added > 0 ? added : 0,
      wordsRemoved: removed > 0 ? removed : 0,
      similarity,
    };
  }
}

export const multiPassOrchestrator = new MultiPassOrchestrator();

import type {
  Fictionality,
  StructureType,
  TargetMarket,
  WorkForm,
  WorkflowStage,
  WorkType,
} from './workModel';
import type {
  StructureSourceRole,
  StructureUnitStatus,
  StructureUnitType,
} from './structureUnit';

export interface Project {
  id: string;
  title: string;
  genre: string;
  description: string;
  targetWordCount: number;
  currentWordCount: number;
  /** Publication lifecycle — unchanged for backward compatibility. */
  status: 'draft' | 'in-progress' | 'complete' | 'published';
  /** Canonical work typing (Phase 2). */
  workType?: WorkType;
  fictionality?: Fictionality;
  form?: WorkForm;
  subgenre?: string;
  targetAudience?: string;
  targetPrizeIds?: string[];
  targetMarket?: TargetMarket;
  structureType?: StructureType;
  /** Pier / production workflow stage. */
  workflowStage?: WorkflowStage;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  projectId: string;
  parentId?: string;
  /** Canonical structure unit type — a scene is not stored as a chapter type. */
  unitType?: StructureUnitType;
  title: string;
  content: string;
  wordCount: number;
  order: number;
  /** Writing workflow status (legacy). */
  status: 'outline' | 'draft' | 'revised' | 'final';
  /** Pier / structure lifecycle status. */
  unitStatus?: StructureUnitStatus;
  sourceRole?: StructureSourceRole;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  description: string;
  backstory: string;
  traits: string[];
  relationships: { characterId: string; type: string }[];
}

export interface ResearchNote {
  id: string;
  projectId: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
}

export interface PlotPoint {
  id: string;
  projectId: string;
  title: string;
  description: string;
  chapterId?: string;
  order: number;
  type:
    | 'inciting-incident'
    | 'rising-action'
    | 'climax'
    | 'falling-action'
    | 'resolution'
    | 'other';
}

export interface AIRequest {
  prompt: string;
  context?: string;
  model?: string;
  projectId?: string;
  chapterId?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  text: string;
  model: string;
  tokensUsed?: number;
  duration?: number;
}

export interface JobStatus {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress: number;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MusicTrack {
  id: string;
  projectId?: string;
  title: string;
  genre: string;
  mood: string;
  tempo: number;
  duration: number;
  filePath?: string;
  sunoPrompt?: string;
  generatedAt: string;
}

export interface MusicCompositionBrief {
  trackId: string;
  title: string;
  instruments: string[];
  structure: string;
  feel: string;
  tempo: number;
  key: string;
  lyricsConcept?: string;
  productionNotes: string;
  sunoPrompt: string;
  musicXmlSkeleton: string;
  createdAt: string;
}

export interface ShowPackage {
  id: string;
  projectId: string;
  title: string;
  type: 'theatre' | 'radio' | 'podcast' | 'live-reading';
  components: string[];
  status: 'generating' | 'ready' | 'exported';
  createdAt: string;
}

export interface ExportJob {
  id: string;
  projectId: string;
  format: 'pdf' | 'epub' | 'docx' | 'kdp' | 'ingram';
  status: 'queued' | 'running' | 'complete' | 'failed';
  outputPath?: string;
  createdAt: string;
}

export interface CASPAConfig {
  port: number;
  dataDir: string;
  ollamaUrl: string;
  ollamaModel: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  grokApiKey?: string;
  dropboxToken?: string;
  backupDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  authEnabled: boolean;
  authSecret: string;
  adminEmail?: string;
  adminPassword?: string;
  jwtExpiresIn: number;
}

// ── Phase 6 Elevation types ──

export type QualityGateStatus = 'PASS' | 'PASS_WITH_WARNINGS' | 'REVISE' | 'BLOCK';

export interface MotifEntry {
  id: string;
  projectId: string;
  label: string;
  description: string;
  occurrences: string[];
  emotionalWeight: number;
  createdAt: string;
  updatedAt: string;
}

export interface TasteProfile {
  id: string;
  name: string;
  description: string;
  controls: {
    warmth: number;
    wit: number;
    darkness: number;
    lyricism: number;
    pace: number;
    commerciality: number;
    authenticity: number;
    spectacle: number;
    intimacy: number;
  };
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoldReportStep {
  step: string;
  label: string;
  status: QualityGateStatus;
  score: number;
  summary: string;
  completedAt: string;
}

export interface GoldReport {
  id: string;
  projectId: string;
  overallStatus: QualityGateStatus;
  overallScore: number;
  steps: GoldReportStep[];
  recommendations: string[];
  blockers: string[];
  startedAt: string;
  completedAt: string;
}

export interface AudienceSimulationResult {
  persona: string;
  loved: string;
  boredBy: string;
  confusedBy: string;
  emotionalReaction: string;
  buyingReaction: string;
  lineRemembered: string;
  commercialObjection: string;
  recommendation: string;
}

export interface ShowstopperBundle {
  posterLines: string[];
  trailerLines: string[];
  finalLines: string[];
  showstopperScenes: string[];
  songHooks: string[];
  riskyOption: string;
}

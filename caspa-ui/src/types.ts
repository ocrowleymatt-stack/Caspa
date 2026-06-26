export type {
  Project,
  WorkType,
  Fictionality,
  WorkForm,
  TargetMarket,
  StructureType,
  WorkflowStage,
} from './lib/workModel';
import type {
  StructureSourceRole,
  StructureUnitStatus,
  StructureUnitType,
} from './lib/structureUnit';
import type {
  ResearchQueueStatus,
  ResearchSourceType,
  ResearchVerificationStatus,
} from './lib/researchDesk';

export interface Chapter {
  id: string;
  projectId: string;
  parentId?: string;
  unitType?: StructureUnitType;
  title: string;
  content: string;
  wordCount: number;
  order: number;
  status: 'outline' | 'draft' | 'revised' | 'final';
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

export interface ProjectStats {
  wordCount: number;
  chapterCount: number;
  characterCount: number;
  plotPointCount: number;
  noteCount: number;
}

export interface AIProvider {
  name: string;
  available: boolean;
  isLocal: boolean;
  configured?: boolean;
  reachable?: boolean;
  canGenerate?: boolean;
  status?:
    | 'ready'
    | 'configured'
    | 'unreachable'
    | 'quota_failed'
    | 'model_missing'
    | 'auth_failed'
    | 'not_configured';
  detail?: string;
  model?: string;
}

export interface CommercialReadinessReport {
  projectId: string;
  overallScore: number;
  categories: {
    manuscriptCompleteness: number;
    marketability: number;
    productionReadiness: number;
    platformReadiness: number;
  };
  recommendations: string[];
  blockers: string[];
  generatedAt: string;
}

export interface MarketingCopyPack {
  tagline: string;
  blurb100: string;
  blurb50: string;
  blurb25: string;
  amazonDescription: string;
  authorBio: string;
  targetAudience: string;
  comparableTitles: string[];
  keywords: string[];
  categories: string[];
}

export interface SocialMediaPack {
  tweets: string[];
  instagramCaptions: string[];
  facebookPost: string;
  linkedInPost: string;
  newsletterTeaser: string;
  launchDayPost: string;
  hashtags: string[];
}

export interface StorageStats {
  projects: number;
  chapters: number;
  characters: number;
  totalWords: number;
  dbSizeKb: number;
}

export interface BackupInfo {
  name: string;
  size: number;
  createdAt: string;
}

export interface ChapterHistoryEntry {
  timestamp: string;
  wordCount: number;
  preview: string;
  content?: string;
}

export interface ResearchNote {
  id: string;
  projectId: string;
  title: string;
  content: string;
  tags: string[];
  verificationStatus?: ResearchVerificationStatus;
  sourceType?: ResearchSourceType;
  queueStatus?: ResearchQueueStatus;
  attachments?: Array<{
    kind: 'project' | 'unit' | 'pole' | 'output' | 'character' | 'place';
    id: string;
    label?: string;
  }>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface Cue {
  id: string;
  order: number;
  label: string;
  type: 'lights' | 'sound' | 'music' | 'actor' | 'props' | 'note';
  timing: 'pre' | 'on' | 'post';
  triggerText: string;
  instruction: string;
  duration?: number;
}

export interface CueList {
  id: string;
  showPackageId: string;
  title: string;
  cues: Cue[];
  createdAt: string;
}

export interface QueueStats {
  total: number;
  queued: number;
  running: number;
  complete: number;
  failed: number;
}

export interface OvernightSchedule {
  id: string;
  projectId: string;
  trackCount: number;
  startHour: number;
  status: string;
}

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

export interface ShowstopperBundle {
  posterLines: string[];
  trailerLines: string[];
  finalLines: string[];
  showstopperScenes: string[];
  songHooks: string[];
  riskyOption: string;
}

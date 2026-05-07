/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Character {
  id: string;
  name: string;
  role: string;
  backstory: string;
  traits: string[];
  goals: string[];
  fears: string[];
  motivations: string[];
  quirks: string[];
  archetype?: string;
  avatarUrl?: string;
  physicalDescription?: string;
  updatedAt: number;
}

export interface PlotNode {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'ended' | 'resolved';
  type: 'main' | 'sub' | 'theme';
  order: number;
  updatedAt: number;
}

export interface Chapter {
  id: string;
  projectId?: string; // Optional for compatibility, populated on save
  title: string;
  summary: string;
  content: string;
  order: number;
  plotNodeIds: string[]; // IDs of PlotNodes active in this chapter
  tags: string[];
  isPlan?: boolean; // If true, this is a planning document, not a draft segment
  updatedAt: number;
  ownerId?: string; // Added for relational security rules
  directives?: string[]; // Directives for next redrafting session
}

export interface ResearchNote {
  id: string;
  title: string;
  content: string;
  source?: string;
  sources?: string[]; // Multiple citation support
  category: string;
  tags: string[];
  updatedAt: number;
  sensoryDetails?: {
    sounds?: string[];
    smells?: string[];
    textures?: string[];
    visuals?: string[];
  };
  isDeepResearch?: boolean;
}

export interface Critique {
  id: string; // Added ID for tracking
  agentName: string;
  role: 'structural' | 'vocal' | 'factual' | 'legal' | 'comedy' | 'academic' | 'agent' | 'publisher' | 'market' | 'buyer' | 'reader' | 'sentence' | 'thematic' | 'medical' | 'historical' | 'sensitivity' | 'writer';
  content: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestions: { text: string; accepted?: boolean; rejected?: boolean }[];
  timestamp?: number;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  position?: number;
  resolved: boolean;
  createdAt: number;
}

export interface Presence {
  userId: string;
  userName: string;
  cursorPosition?: number;
  activeChapterId?: string;
  lastSeen: number;
}

export type ProjectType = 'novel' | 'screenplay' | 'stageplay' | 'radioplay' | 'legal' | 'academic' | 'experimental' | 'coursebook' | 'subject_bible' | 'cookbook' | 'illustrated';
export type MaturityLevel = 'standard' | 'mature' | 'transgressive';

export interface SourceMaterial {
  id: string;
  name: string;
  content: string;
  type: string;
  updatedAt?: number;
}

export interface PrizeAssessment {
  prizeName: string;
  eligibilityScore: number; // 0-100
  pros: string[];
  cons: string[];
  recommendation: string;
  targetWordCount?: number;
}

export type IntelligenceProvider = 'gemini' | 'claude' | 'openai' | 'grok';

export interface PublishingConfig {
  trimSize: '5x8' | '5.5x8.5' | '6x9' | '8.27x11.69'; // Common KDP sizes
  paperType: 'white' | 'cream' | 'color';
  coverTheme: {
    backgroundColor: string;
    textColor: string;
    fontFamily: string;
    imageUrl?: string;
    accentColor: string;
    isOverlayHidden?: boolean;
    aiPrompt?: string;
  };
  authorName?: string;
  subtitle?: string;
}

export interface ExternalReview {
  id: string;
  source: string;
  content: string;
  score?: number;
  date: number;
  isImplemented: boolean;
}

export interface Project {
  id: string;
  title: string;
  type: ProjectType;
  maturity: MaturityLevel;
  genre: string;
  premise: string;
  tone: string;
  ownerId: string;
  collaborators: string[];
  lastModified: number;
  createdAt: number;
  updatedAt?: any;
  primaryProvider?: IntelligenceProvider; 
  publishing?: PublishingConfig;
  // Optional merged data for UI views
  characters?: Character[];
  plotNodes?: PlotNode[];
  chapters?: Chapter[];
  research?: ResearchNote[];
  sourceMaterials?: SourceMaterial[];
  externalReviews?: ExternalReview[];
  critiques?: { [documentId: string]: Critique[] };
    stats?: {
    narrativeStreak: number;
    totalWords: number;
    aiContributions: number;
    revCount?: number;
    lastActiveDay: string; // ISO date string
  };
  targetPrize?: string;
  prizeAssessments?: PrizeAssessment[];
  targetWordCount?: number;
  isPublic?: boolean;
  publicId?: string;
  styleDNA?: {
    proseIntensity: number; // 0-100
    dialogueWeight: number; // 0-100
    sensoryPriority: 'visual' | 'auditory' | 'olfactory' | 'tactile' | 'balanced';
    aiPersona?: string;
    vocabularyLevel: 'simple' | 'elevated' | 'erudite' | 'technical';
    narrativeRhythm: number; // 0-100
  };
  isLocked?: boolean;
  draftStage?: 1 | 2 | 3 | 4;
  draftPassHistory?: { pass: number; completedAt: number; wordCountAtCompletion: number }[];
  cutMode?: boolean;
}

export type ViewType = 'dashboard' | 'brainstorm' | 'characters' | 'plot' | 'writing' | 'intelligence' | 'swarm' | 'settings' | 'architect' | 'export' | 'prizes' | 'publishing' | 'reviews' | 'library';

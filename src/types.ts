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
  title: string;
  summary: string;
  content: string;
  order: number;
  plotNodeIds: string[]; // IDs of PlotNodes active in this chapter
  tags: string[];
  updatedAt: number;
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
}

export interface Critique {
  agentName: string;
  role: 'structural' | 'vocal' | 'factual' | 'legal' | 'comedy' | 'academic';
  content: string;
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
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

export type ProjectType = 'novel' | 'screenplay' | 'stageplay' | 'radioplay' | 'legal' | 'academic' | 'experimental';
export type MaturityLevel = 'standard' | 'mature' | 'transgressive';

export interface SourceMaterial {
  id: string;
  name: string;
  content: string;
  type: string;
  updatedAt?: number;
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
  // Optional merged data for UI views
  characters?: Character[];
  plotNodes?: PlotNode[];
  chapters?: Chapter[];
  research?: ResearchNote[];
  sourceMaterials?: SourceMaterial[];
  critiques?: { [documentId: string]: Critique[] };
  stats?: {
    narrativeStreak: number;
    totalWords: number;
    aiContributions: number;
    lastActiveDay: string; // ISO date string
  };
}

export type ViewType = 'dashboard' | 'brainstorm' | 'characters' | 'plot' | 'writing' | 'research' | 'swarm' | 'settings' | 'architect';

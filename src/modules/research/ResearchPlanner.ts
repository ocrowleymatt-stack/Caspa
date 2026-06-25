export interface ResearchTask {
  id: string;
  topic: string;
  priority: 'high' | 'medium' | 'low';
  method: string;
  notes: string;
}

export interface ResearchPlan {
  projectId?: string;
  query: string;
  tasks: ResearchTask[];
  stubNotice: string;
  createdAt: string;
}

export class ResearchPlanner {
  plan(query: string, projectId?: string): ResearchPlan {
    const topics = query.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
    const base = topics.length ? topics : [query];

    const tasks: ResearchTask[] = base.map((topic, i) => ({
      id: `task-${i + 1}`,
      topic,
      priority: i === 0 ? 'high' : 'medium',
      method: 'manual_source',
      notes: 'Use ManualSourceProvider — web research stub is unavailable.',
    }));

    return {
      projectId,
      query,
      tasks,
      stubNotice: 'Automated web research is unavailable. Plan tasks for manual verification.',
      createdAt: new Date().toISOString(),
    };
  }
}

export const researchPlanner = new ResearchPlanner();

import { findById } from '../../shared/db';

export interface CommandContext {
  projectId?: string;
  projectTitle?: string;
  userId?: string;
  activeModule?: string;
  timestamp: string;
}

export class CommandContextBuilder {
  async build(opts: {
    projectId?: string;
    userId?: string;
    activeModule?: string;
  }): Promise<CommandContext> {
    const ctx: CommandContext = {
      projectId: opts.projectId,
      userId: opts.userId,
      activeModule: opts.activeModule,
      timestamp: new Date().toISOString(),
    };

    if (opts.projectId) {
      const project = await findById<{ id: string; title: string }>('projects', opts.projectId);
      if (project) {
        ctx.projectTitle = project.title;
      }
    }

    return ctx;
  }
}

export const commandContextBuilder = new CommandContextBuilder();

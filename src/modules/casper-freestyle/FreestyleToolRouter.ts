import { toolRegistry } from '../command-orchestrator/ToolRegistry';
import type { ParsedFreestyleCommand } from './FreestyleCommandParser';

export interface RoutedAction {
  toolId: string;
  route: string;
  method: string;
  description: string;
}

export class FreestyleToolRouter {
  route(parsed: ParsedFreestyleCommand): RoutedAction[] {
    return parsed.suggestedTools
      .map((id) => toolRegistry.getTool(id))
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .map((t) => ({
        toolId: t.id,
        route: t.route,
        method: t.method,
        description: t.description,
      }));
  }
}

export const freestyleToolRouter = new FreestyleToolRouter();

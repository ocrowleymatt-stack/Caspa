import { useOutletContext } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { AgentSwarmContent } from '../AgentSwarm';
import type { ProjectWorkbenchContext } from '../../components/workbench/ProjectWorkbenchShell';

export default function ProjectAgentSwarm() {
  const { projectId } = useOutletContext<ProjectWorkbenchContext>();

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#dfc991] bg-[#fffaf0] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#98711d]">
          <Bot className="h-4 w-4" /> Agent Swarm
        </div>
        <h2 className="font-serif text-3xl font-semibold text-[#171a22]">Collaborative critique</h2>
        <p className="mt-2 text-sm text-muted">
          Distinct agents, one consensus plan. Source text comes from the workbench selector unless you override below.
        </p>
      </div>
      <AgentSwarmContent projectId={projectId} />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, Loader2, Sparkles, Users } from 'lucide-react';
import { ElevationWorkbench } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { useAppStore } from '../store';
import { useWorkbenchSourceText } from '../hooks/useWorkbenchSourceText';
import {
  listSwarmAgents,
  runAgentSwarm,
  SWARM_MODE_LABELS,
  type AgentSwarmResult,
  type SwarmMode,
} from '../api/agentSwarm';
import { getProjectAwardsShelf } from '../api/awards';

function AgentSwarmContentInner({ projectId }: { projectId: string }) {
  const toast = useToast();
  const workbenchSource = useAppStore((s) => s.workbenchSource);
  const { text: workbenchText } = useWorkbenchSourceText(projectId, workbenchSource);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [mode, setMode] = useState<SwarmMode>('critique');
  const [sourceText, setSourceText] = useState('');
  const [result, setResult] = useState<AgentSwarmResult | null>(null);

  const { data: agents = [] } = useQuery({
    queryKey: ['swarm-agents'],
    queryFn: listSwarmAgents,
  });

  const { data: shelf } = useQuery({
    queryKey: ['project-awards', projectId],
    queryFn: () => getProjectAwardsShelf(projectId),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (agents.length > 0 && selectedAgents.length === 0) {
      setSelectedAgents(agents.slice(0, 6).map((agent) => agent.id));
    }
  }, [agents, selectedAgents.length]);

  const swarmMutation = useMutation({
    mutationFn: () =>
      runAgentSwarm({
        projectId,
        sourceText: sourceText.trim() || workbenchText || undefined,
        agentIds: selectedAgents,
        targetAwardIds: shelf?.selectedAwardIds,
        mode,
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Swarm saved · ${data.outputId.slice(0, 8)}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleAgent = (id: string) => {
    setSelectedAgents((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const groupedAgents = useMemo(() => agents, [agents]);

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-[#98711d]" />
          <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Choose agents</h2>
        </div>
        <p className="mb-5 text-sm leading-7 text-muted">
          Each agent has a distinct scope — the swarm synthesizes one consensus plan, not twelve contradictory notes.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {groupedAgents.map((agent) => {
            const selected = selectedAgents.includes(agent.id);
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => toggleAgent(agent.id)}
                className={`rounded-[1.2rem] border p-3 text-left text-sm transition-all ${
                  selected
                    ? 'border-[#98711d] bg-[#fffaf0]'
                    : 'border-[#eadfca] bg-[#fffdf8] hover:border-[#caa044]'
                }`}
              >
                <div className="font-semibold text-[#171a22]">{agent.name}</div>
                <div className="mt-1 text-xs leading-5 text-[#5f5648]">{agent.scope}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <label className="block text-sm">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Mode</span>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as SwarmMode)}
              className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#caa044]"
            >
              {Object.entries(SWARM_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">
              Override text (optional — workbench source selector applies when empty)
            </span>
            <textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#caa044]"
              placeholder="Paste passage for the swarm to review…"
            />
          </label>
        </div>
        {shelf && shelf.selectedAwardIds.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Using Awards Shelf lenses: {shelf.awards.map((award) => award.name).join(' · ')}
          </p>
        )}
        <button
          type="button"
          onClick={() => swarmMutation.mutate()}
          disabled={swarmMutation.isPending || selectedAgents.length === 0}
          className="btn-primary mt-4"
        >
          {swarmMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Run swarm ({selectedAgents.length} agents)
        </button>
      </section>

      {result && (
        <section className="space-y-5">
          <div className="rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] p-5">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Consensus</div>
            <p className="mt-2 text-sm leading-7 text-[#5f5648]">{result.consensus.summary}</p>
            <Link to={`/outputs/${result.outputId}`} className="btn-secondary mt-4 inline-flex text-xs">
              Open saved output
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.5rem] border border-[#eadfca] bg-white p-5">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Revision plan</div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#5f5648]">
                {result.consensus.revisionPlan.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-[1.5rem] border border-[#eadfca] bg-white p-5">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Do not change</div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#5f5648]">
                {(result.consensus.doNotChange.length ? result.consensus.doNotChange : ['Voice and core intent']).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {result.agentReports.map((report) => (
              <div key={report.agentId} className="rounded-[1.4rem] border border-[#eadfca] bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-serif text-lg font-semibold text-[#171a22]">{report.agent}</div>
                  <div className="text-lg font-semibold text-[#98711d]">{report.score}</div>
                </div>
                <ul className="mt-2 list-disc pl-5 text-sm text-[#5f5648]">
                  {report.findings.slice(0, 2).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {result.revisedText && (
            <div className="rounded-[1.5rem] border border-[#eadfca] bg-white p-5">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Revised text</div>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap font-serif text-sm leading-7 text-[#171a22]">
                {result.revisedText}
              </pre>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function AgentSwarmContent({ projectId }: { projectId: string }) {
  return <AgentSwarmContentInner projectId={projectId} />;
}

export default function AgentSwarm() {
  return (
    <ElevationWorkbench
      title="Agent Swarm"
      subtitle="Run distinct editorial agents, synthesize one consensus plan, and save reports to Outputs."
      icon={<Bot className="h-4 w-4 text-[#98711d]" />}
    >
      {({ projectId }) => <AgentSwarmContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}

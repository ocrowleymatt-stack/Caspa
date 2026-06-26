import type { OutputProvenanceView } from '../../lib/outputSemantics';

function ProvenanceRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm leading-6 text-[#3d352b]">
      <span className="font-semibold text-[#171a22]">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

export function OutputProvenancePanel({
  provenance,
  projectTitle,
  outputId,
  createdAt,
}: {
  provenance: OutputProvenanceView;
  projectTitle?: string;
  outputId: string;
  createdAt: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-[#eadfca] bg-[#fffdf8] p-4">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">
        Output provenance
      </div>
      <div className="mt-3 space-y-1.5">
        <ProvenanceRow label="Kind" value={provenance.kindLabel} />
        {projectTitle && <ProvenanceRow label="Project" value={projectTitle} />}
        <ProvenanceRow label="Work type" value={provenance.workTypeLabel} />
        <ProvenanceRow label="Source" value={provenance.sourceLabel} />
        <ProvenanceRow label="Unit / structure" value={provenance.unitLabel} />
        <ProvenanceRow label="Research used" value={provenance.researchLabel} />
        <ProvenanceRow label="Award targets" value={provenance.awardsLabel} />
        <ProvenanceRow label="Agent swarm" value={provenance.swarmLabel} />
        <ProvenanceRow label="Stage" value={provenance.stageLabel} />
        <ProvenanceRow label="Provider" value={provenance.providerLabel} />
        <ProvenanceRow
          label="Archive id"
          value={`${outputId.slice(0, 8)} · ${new Date(createdAt).toLocaleString()}`}
        />
      </div>
    </div>
  );
}

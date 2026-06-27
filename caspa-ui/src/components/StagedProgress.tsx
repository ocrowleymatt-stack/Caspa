import { Loader2 } from 'lucide-react';

interface StagedProgressProps {
  label: string;
  stages: string[];
  activeStage?: number;
  pending?: boolean;
}

export function StagedProgress({ label, stages, activeStage = 0, pending }: StagedProgressProps) {
  if (!pending) return null;

  return (
    <div className="rounded-[1.5rem] border border-[#caa044] bg-[#fff8e8] p-5 text-sm text-[#5f5648]">
      <div className="flex items-center gap-2 font-semibold text-[#171a22]">
        <Loader2 className="h-4 w-4 animate-spin text-[#98711d]" />
        {label}
      </div>
      <ol className="mt-4 space-y-2">
        {stages.map((stage, index) => (
          <li
            key={stage}
            className={`flex items-center gap-2 ${index <= activeStage ? 'text-[#171a22]' : 'text-[#b8aa91]'}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${index < activeStage ? 'bg-emerald-500' : index === activeStage ? 'animate-pulse bg-[#98711d]' : 'bg-[#eadfca]'}`}
            />
            {stage}
          </li>
        ))}
      </ol>
    </div>
  );
}

export const NOVEL_WRITE_PRO_STAGES = [
  'Reading project context',
  'Building project bible',
  'Reading book map',
  'Planning scenes',
  'Drafting',
  'Critic room reviewing',
  'Rewriting',
  'Saving output',
];

export const FINISH_BOOK_STAGES = [
  'Reading manuscript structure',
  'Finding gaps',
  'Building book map',
  'Choosing next chapter',
  'Drafting plan',
  'Saving finish roadmap',
];

export const TRASH_TO_TREASURE_STAGES = [
  'Reading rough material',
  'Detecting structure',
  'Diagnosing problems',
  'Finding strongest idea',
  'Building rescue plan',
  'Rewriting sample',
  'Creating finish roadmap',
  'Saving rescued output',
];

export const GOLD_PASS_STAGES = [
  'Reading source',
  'Loading project memory',
  'Scoring quality',
  'Finding structural issues',
  'Finding prose issues',
  'Rewriting',
  'Saving gold output',
];

export const SWARM_STAGES = [
  'Selecting agents',
  'Reading source',
  'Independent agent reads',
  'Consensus meeting',
  'Revision plan',
  'Saving report',
];

export const BOOK_MAP_STAGES = [
  'Reading manuscript',
  'Loading Project Bible',
  'Analysing structure',
  'Mapping arcs and threads',
  'Finding missing chapters',
  'Saving Book Map',
];

export const CONTINUE_STAGES = [
  'Reading chapter context',
  'Loading project memory',
  'Continuing prose',
  'Saving output',
];

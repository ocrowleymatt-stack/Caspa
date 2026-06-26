import { useOutletContext } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { AwardsShelfContent } from '../Awards';
import type { ProjectWorkbenchContext } from '../../components/workbench/ProjectWorkbenchShell';

export default function ProjectAwards() {
  const { projectId } = useOutletContext<ProjectWorkbenchContext>();

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#dfc991] bg-[#fffaf0] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#98711d]">
          <Trophy className="h-4 w-4" /> Awards Shelf
        </div>
        <h2 className="font-serif text-3xl font-semibold text-[#171a22]">Target lenses</h2>
        <p className="mt-2 text-sm text-muted">
          Choose prize and market rubrics, run judges&apos; assessment, feed results into Swarm and Gold.
        </p>
      </div>
      <AwardsShelfContent projectId={projectId} />
    </div>
  );
}

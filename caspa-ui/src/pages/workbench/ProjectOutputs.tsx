import { useOutletContext } from 'react-router-dom';
import { OutputsContent } from '../Outputs';
import type { ProjectWorkbenchContext } from '../../components/workbench/ProjectWorkbenchShell';

export default function ProjectOutputs() {
  const { projectId } = useOutletContext<ProjectWorkbenchContext>();
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Writing History</div>
        <h2 className="mt-1 font-serif text-3xl font-semibold text-[#171a22]">Draft archive</h2>
        <p className="mt-2 text-sm text-muted">
          Alternatives and past passes — compare and apply. Read the live work on Manuscript / Current Work.
        </p>
      </div>
      <OutputsContent projectId={projectId} />
    </div>
  );
}

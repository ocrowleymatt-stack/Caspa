import { useOutletContext } from 'react-router-dom';
import { OutputsContent } from '../Outputs';
import type { ProjectWorkbenchContext } from '../../components/workbench/ProjectWorkbenchShell';

export default function ProjectOutputs() {
  const { projectId } = useOutletContext<ProjectWorkbenchContext>();
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Outputs archive</div>
        <h2 className="mt-1 font-serif text-3xl font-semibold text-[#171a22]">Project memory</h2>
        <p className="mt-2 text-sm text-muted">
          Every AI pass saves here first. Apply to manuscript only when you choose.
        </p>
      </div>
      <OutputsContent projectId={projectId} />
    </div>
  );
}

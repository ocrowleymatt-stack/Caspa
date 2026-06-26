import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2 } from 'lucide-react';
import { getProjectStructure } from '../../api/chapters';
import { structureLabel, workTypeLabel } from '../../lib/workModel';
import { sourceRoleLabel, structureUnitLabel } from '../../lib/structureUnit';
import { useOutletContext } from 'react-router-dom';
import type { ProjectWorkbenchContext } from '../../components/workbench/ProjectWorkbenchShell';

export default function ProjectStructure() {
  const { projectId, project } = useOutletContext<ProjectWorkbenchContext>();

  const { data: structure, isLoading } = useQuery({
    queryKey: ['project-structure', projectId],
    queryFn: () => getProjectStructure(projectId),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper md:p-8">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Structure model</div>
        <h2 className="mt-1 font-serif text-3xl font-semibold text-[#171a22]">Canonical units</h2>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-[#eadfca] bg-[#fffdf8] px-3 py-1">
            {workTypeLabel(project.workType) || project.genre}
          </span>
          {project.structureType && (
            <span className="rounded-full border border-[#eadfca] bg-[#fffdf8] px-3 py-1">
              {structureLabel(project.structureType)}
            </span>
          )}
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
          Chapters, scenes, acts, essays, and poems are structure units — not interchangeable labels.
          AI outputs land in Outputs first; you apply them to units explicitly.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to={`/projects/${projectId}/pier`} className="btn-primary text-sm">
            Open Pier Builder
          </Link>
          <Link to={`/projects/${projectId}/plot`} className="btn-secondary text-sm">
            Plot board
          </Link>
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#98711d]" />
        </div>
      ) : !structure?.flatUnits.length ? (
        <div className="rounded-[2rem] border border-[#eadfca] bg-white/85 py-14 text-center shadow-paper">
          <FileText className="mx-auto mb-4 h-12 w-12 text-[#98711d] opacity-60" />
          <p className="text-muted">No structure units yet. Import a manuscript or place your first pole.</p>
          <Link to={`/projects/${projectId}/manuscript`} className="btn-primary mt-5 inline-flex">
            Go to Manuscript
          </Link>
        </div>
      ) : (
        <section className="space-y-3">
          {structure.flatUnits
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((unit) => (
              <div
                key={unit.id}
                className="rounded-[1.6rem] border border-[#eadfca] bg-white px-5 py-4 shadow-paper"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link
                      to={`/projects/${projectId}/chapters/${unit.id}`}
                      className="font-serif text-xl font-semibold text-[#171a22] hover:text-[#98711d]"
                    >
                      {unit.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {unit.wordCount.toLocaleString()} words · order {unit.order + 1}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {unit.unitType && (
                      <span className="rounded-full border border-[#eadfca] bg-[#fffdf8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#98711d]">
                        {structureUnitLabel(unit.unitType)}
                      </span>
                    )}
                    {sourceRoleLabel(unit.sourceRole) && (
                      <span className="rounded-full border border-[#eadfca] bg-[#fffdf8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f5648]">
                        {sourceRoleLabel(unit.sourceRole)}
                      </span>
                    )}
                    <span className="badge capitalize">{unit.status}</span>
                  </div>
                </div>
              </div>
            ))}
        </section>
      )}
    </div>
  );
}

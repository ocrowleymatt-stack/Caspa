import { Link } from 'react-router-dom';
import { Archive, FilePlus, Replace, SplitSquareHorizontal } from 'lucide-react';

interface Props {
  projectId: string;
  outputId?: string;
  sourceChapterId?: string;
  hasText?: boolean;
}

const ACTIONS = [
  { id: 'keep', label: 'Keep as output', icon: Archive, hint: 'Default — nothing touches the manuscript' },
  { id: 'append', label: 'Append to unit', icon: SplitSquareHorizontal, hint: 'Add to end of selected chapter' },
  { id: 'insert', label: 'Insert after point', icon: FilePlus, hint: 'Place after a structural marker' },
  { id: 'replace', label: 'Replace selection', icon: Replace, hint: 'Requires confirmation in output view' },
  { id: 'new-unit', label: 'Save as new unit', icon: FilePlus, hint: 'Creates a draft unit — never overwrites source' },
] as const;

export function WorkbenchApplyRail({ projectId, outputId, sourceChapterId, hasText }: Props) {
  const detailHref = outputId ? `/outputs/${outputId}` : `/projects/${projectId}/outputs`;
  const canOpen = Boolean(hasText || outputId);

  return (
    <section className="rounded-[1.6rem] border border-[#eadfca] bg-white p-5 shadow-paper">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Apply safely</div>
      <p className="mt-2 text-sm leading-6 text-muted">
        AI work stays in Outputs until you explicitly apply it. Original uploads are never overwritten silently.
      </p>
      <ul className="mt-4 space-y-3">
        {ACTIONS.map((action) => (
          <li key={action.id} className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171a22]">
              <action.icon className="h-4 w-4 text-[#98711d]" />
              {action.label}
            </div>
            <p className="mt-1 text-xs leading-5 text-[#5f5648]">{action.hint}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-5 text-muted">
        Apply actions run from the output detail view with confirmation — not from this panel.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={detailHref}
          className={`btn-primary text-xs ${!canOpen ? 'pointer-events-none opacity-50' : ''}`}
        >
          Open output to apply
        </Link>
        {sourceChapterId && (
          <Link
            to={`/projects/${projectId}/chapters/${sourceChapterId}`}
            className="btn-secondary text-xs"
          >
            Open chapter editor
          </Link>
        )}
        <Link to={`/projects/${projectId}/export`} className="btn-secondary text-xs">
          Export package
        </Link>
      </div>
    </section>
  );
}

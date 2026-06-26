import { useQuery } from '@tanstack/react-query';
import { Crosshair } from 'lucide-react';
import { listOutputs } from '../../api/outputs';
import { useWorkbenchSourceText } from '../../hooks/useWorkbenchSourceText';
import {
  WORKBENCH_SOURCE_LABELS,
  workbenchSourceSummary,
  type WorkbenchSourceMode,
} from '../../lib/workbenchSource';
import { useAppStore } from '../../store';

const MODES: WorkbenchSourceMode[] = [
  'whole-manuscript',
  'selected-unit',
  'selected-output',
  'clipboard',
  'research-note',
  'custom',
];

interface Props {
  projectId: string;
  compact?: boolean;
}

export function WorkbenchSourceSelector({ projectId, compact = false }: Props) {
  const source = useAppStore((s) => s.workbenchSource);
  const patchWorkbenchSource = useAppStore((s) => s.patchWorkbenchSource);
  const { text, label, wordCount, chapters, researchNotes, ready } = useWorkbenchSourceText(
    projectId,
    source,
  );

  const { data: outputs = [] } = useQuery({
    queryKey: ['outputs', projectId],
    queryFn: () =>
      listOutputs(projectId) as Promise<Array<{ id: string; type: string; title: string }>>,
    enabled: !!projectId && source.mode === 'selected-output',
  });

  return (
    <section
      className={`rounded-[1.6rem] border border-[#eadfca] bg-[#fffdf8] ${
        compact ? 'p-4' : 'p-5'
      } shadow-paper`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Crosshair className="h-4 w-4 text-[#98711d]" />
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">
            Source selector
          </div>
          <p className="text-xs text-muted">Shared across Pier, Research, Swarm, Awards, and Gold</p>
        </div>
      </div>

      <label className="block text-sm">
        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#98711d]">
          Source type
        </span>
        <select
          value={source.mode}
          onChange={(event) =>
            patchWorkbenchSource({ mode: event.target.value as WorkbenchSourceMode })
          }
          className="w-full rounded-2xl border border-[#eadfca] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#caa044]"
        >
          {MODES.map((mode) => (
            <option key={mode} value={mode}>
              {WORKBENCH_SOURCE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>

      {source.mode === 'selected-unit' && (
        <label className="mt-3 block text-sm">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#98711d]">
            Structure unit
          </span>
          <select
            value={source.unitId ?? ''}
            onChange={(event) => patchWorkbenchSource({ unitId: event.target.value || undefined })}
            className="w-full rounded-2xl border border-[#eadfca] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#caa044]"
          >
            <option value="">Select unit…</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.title} ({chapter.wordCount.toLocaleString()} words)
              </option>
            ))}
          </select>
        </label>
      )}

      {source.mode === 'selected-output' && (
        <label className="mt-3 block text-sm">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#98711d]">
            Output
          </span>
          <select
            value={source.outputId ?? ''}
            onChange={(event) => patchWorkbenchSource({ outputId: event.target.value || undefined })}
            className="w-full rounded-2xl border border-[#eadfca] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#caa044]"
          >
            <option value="">Select output…</option>
            {outputs.map((output) => (
              <option key={output.id} value={output.id}>
                {output.type} · {output.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {source.mode === 'research-note' && (
        <label className="mt-3 block text-sm">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#98711d]">
            Research note
          </span>
          <select
            value={source.researchNoteId ?? ''}
            onChange={(event) =>
              patchWorkbenchSource({ researchNoteId: event.target.value || undefined })
            }
            className="w-full rounded-2xl border border-[#eadfca] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#caa044]"
          >
            <option value="">Select note…</option>
            {researchNotes.map((note) => (
              <option key={note.id} value={note.id}>
                {note.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {(source.mode === 'clipboard' || source.mode === 'custom') && (
        <label className="mt-3 block text-sm">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#98711d]">
            {source.mode === 'clipboard' ? 'Paste text' : 'Custom selection'}
          </span>
          <textarea
            value={source.customText ?? ''}
            onChange={(event) => patchWorkbenchSource({ customText: event.target.value })}
            rows={compact ? 3 : 4}
            className="w-full rounded-2xl border border-[#eadfca] bg-white px-4 py-3 text-sm outline-none focus:border-[#caa044]"
            placeholder="Paste or type the passage every AI tool should use…"
          />
        </label>
      )}

      <div className="mt-4 rounded-2xl border border-[#eadfca] bg-white px-4 py-3 text-xs leading-6 text-[#5f5648]">
        <div className="font-semibold text-[#171a22]">{label}</div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#98711d]">
          {ready ? `${wordCount.toLocaleString()} words ready` : 'No source text yet'}
        </div>
        {!compact && text.trim() && (
          <p className="mt-2 line-clamp-3 font-serif text-sm leading-6 text-[#3d352b]">
            {text.trim().slice(0, 240)}
            {text.length > 240 ? '…' : ''}
          </p>
        )}
        <p className="mt-2 text-[10px] text-muted">{workbenchSourceSummary(source)}</p>
      </div>
    </section>
  );
}

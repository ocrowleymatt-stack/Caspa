import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getChapter, listChapters } from '../api/chapters';
import { getOutput } from '../api/outputs';
import { listResearchDeskNotes } from '../api/research';
import { extractOutputText } from '../lib/outputSemantics';
import type { WorkbenchSource } from '../lib/workbenchSource';

const MANUSCRIPT_SLICE = 120_000;

export function useWorkbenchSourceText(projectId: string | undefined, source: WorkbenchSource) {
  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => listChapters(projectId!),
    enabled: !!projectId,
  });

  const { data: unitChapter } = useQuery({
    queryKey: ['chapter', source.unitId],
    queryFn: () => getChapter(source.unitId!),
    enabled: !!source.unitId && source.mode === 'selected-unit',
  });

  const { data: outputRecord } = useQuery({
    queryKey: ['output', source.outputId],
    queryFn: () => getOutput(source.outputId!) as Promise<{ metadata?: { text?: string } }>,
    enabled: !!source.outputId && source.mode === 'selected-output',
  });

  const { data: researchNotes = [] } = useQuery({
    queryKey: ['research-desk', projectId],
    queryFn: () => listResearchDeskNotes(projectId!),
    enabled: !!projectId && source.mode === 'research-note',
  });

  const wholeManuscript = useMemo(
    () =>
      [...chapters]
        .sort((a, b) => a.order - b.order)
        .map((chapter) => chapter.content)
        .join('\n\n')
        .slice(0, MANUSCRIPT_SLICE),
    [chapters],
  );

  const researchNote = useMemo(
    () => researchNotes.find((note) => note.id === source.researchNoteId),
    [researchNotes, source.researchNoteId],
  );

  const text = useMemo(() => {
    switch (source.mode) {
      case 'whole-manuscript':
        return wholeManuscript;
      case 'selected-unit':
        return unitChapter?.content ?? '';
      case 'selected-output':
        return extractOutputText(outputRecord?.metadata);
      case 'clipboard':
      case 'custom':
        return source.customText ?? '';
      case 'research-note':
        return researchNote?.content ?? '';
      default:
        return wholeManuscript;
    }
  }, [
    outputRecord?.metadata,
    researchNote?.content,
    source.customText,
    source.mode,
    unitChapter?.content,
    wholeManuscript,
  ]);

  const label = useMemo(() => {
    switch (source.mode) {
      case 'whole-manuscript':
        return `Whole manuscript (${chapters.length} units)`;
      case 'selected-unit':
        return unitChapter?.title ?? 'Selected unit';
      case 'selected-output':
        return 'Selected output';
      case 'research-note':
        return researchNote?.title ?? 'Research note';
      case 'clipboard':
        return 'Pasted text';
      case 'custom':
        return 'Custom text';
      default:
        return 'Source';
    }
  }, [chapters.length, researchNote?.title, source.mode, unitChapter?.title]);

  return {
    text,
    label,
    wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
    chapters,
    researchNotes,
    ready: text.trim().length > 0,
  };
}

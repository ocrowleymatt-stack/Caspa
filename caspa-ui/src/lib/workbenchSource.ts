export type WorkbenchSourceMode =
  | 'whole-manuscript'
  | 'selected-unit'
  | 'selected-output'
  | 'clipboard'
  | 'research-note'
  | 'custom';

export interface WorkbenchSource {
  mode: WorkbenchSourceMode;
  unitId?: string;
  outputId?: string;
  researchNoteId?: string;
  customText?: string;
}

export const WORKBENCH_SOURCE_LABELS: Record<WorkbenchSourceMode, string> = {
  'whole-manuscript': 'Whole manuscript',
  'selected-unit': 'Selected unit',
  'selected-output': 'Selected output',
  clipboard: 'Clipboard / pasted text',
  'research-note': 'Research note',
  custom: 'Custom selection',
};

export const DEFAULT_WORKBENCH_SOURCE: WorkbenchSource = {
  mode: 'whole-manuscript',
};

export function workbenchSourceSummary(source: WorkbenchSource): string {
  switch (source.mode) {
    case 'whole-manuscript':
      return 'All structure units combined';
    case 'selected-unit':
      return source.unitId ? `Unit ${source.unitId.slice(0, 8)}` : 'Pick a unit below';
    case 'selected-output':
      return source.outputId ? `Output ${source.outputId.slice(0, 8)}` : 'Pick an output below';
    case 'clipboard':
      return source.customText?.trim()
        ? `${source.customText.trim().slice(0, 48)}…`
        : 'Paste text in the selector';
    case 'research-note':
      return source.researchNoteId
        ? `Note ${source.researchNoteId.slice(0, 8)}`
        : 'Pick a research note';
    case 'custom':
      return source.customText?.trim()
        ? `${source.customText.trim().slice(0, 48)}…`
        : 'Enter custom text';
    default:
      return WORKBENCH_SOURCE_LABELS[source.mode];
  }
}

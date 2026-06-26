import {
  IMPORT_MODE_LABELS,
  type ImportAnalysisResult,
  type RecommendedImportMode,
} from '../api/manuscriptImport';
import {
  PRIMARY_WORK_TYPES,
  WORK_TYPE_LABELS,
  structureLabel,
  type WorkType,
} from '../lib/workModel';

interface ImportReviewPanelProps {
  analysis: ImportAnalysisResult;
  filename?: string | null;
  selectedWorkType: WorkType;
  selectedImportMode: RecommendedImportMode;
  onWorkTypeChange: (workType: WorkType) => void;
  onImportModeChange: (mode: RecommendedImportMode) => void;
}

export function ImportReviewPanel({
  analysis,
  filename,
  selectedWorkType,
  selectedImportMode,
  onWorkTypeChange,
  onImportModeChange,
}: ImportReviewPanelProps) {
  const modes: RecommendedImportMode[] = [
    'whole-manuscript-source',
    'split-into-units',
    'single-unit',
    'research-notes',
  ];

  return (
    <div className="rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] p-4 shadow-paper">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">
        Import review
      </div>
      <p className="mt-2 text-sm leading-6 text-[#5f5648]">
        CASPA detected structure in {filename ? `"${filename}"` : 'your upload'}. Choose how to
        import before anything is saved — your original will not be overwritten silently.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#eadfca] bg-white p-3 text-sm">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#98711d]">Detected</div>
          <p className="mt-1 font-semibold text-[#171a22]">{WORK_TYPE_LABELS[analysis.detectedWorkType]}</p>
          <p className="text-xs text-muted capitalize">Confidence: {analysis.confidence}</p>
        </div>
        <div className="rounded-2xl border border-[#eadfca] bg-white p-3 text-sm">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#98711d]">Size</div>
          <p className="mt-1 font-semibold text-[#171a22]">{analysis.totalWordCount.toLocaleString()} words</p>
          <p className="text-xs text-muted">{analysis.detectedUnits.length} unit(s) detected</p>
        </div>
      </div>

      {analysis.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-2xl border border-amber-200 bg-[#fff8e8] p-3 text-sm text-[#5f5648]">
          {analysis.warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      )}

      {analysis.detectedUnits.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">
            Detected units ({structureLabel(analysis.structureType)})
          </div>
          <ul className="max-h-36 space-y-1 overflow-auto rounded-2xl border border-[#eadfca] bg-white p-3 text-sm">
            {analysis.detectedUnits.slice(0, 12).map((unit, index) => (
              <li key={`${unit.title}-${index}`} className="flex justify-between gap-3 text-[#3d352b]">
                <span className="truncate">{unit.title}</span>
                <span className="shrink-0 text-xs text-muted">{unit.wordCount.toLocaleString()} w</span>
              </li>
            ))}
            {analysis.detectedUnits.length > 12 && (
              <li className="text-xs text-muted">…and {analysis.detectedUnits.length - 12} more</li>
            )}
          </ul>
        </div>
      )}

      <label className="mt-4 block text-sm text-[#5f5648]">
        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">
          Correct work type
        </span>
        <select
          value={selectedWorkType}
          onChange={(event) => onWorkTypeChange(event.target.value as WorkType)}
          className="input"
        >
          {PRIMARY_WORK_TYPES.map((workType) => (
            <option key={workType} value={workType}>
              {WORK_TYPE_LABELS[workType]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="mt-4 space-y-2">
        <legend className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">
          Import as
        </legend>
        {modes.map((mode) => (
          <label
            key={mode}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
              selectedImportMode === mode
                ? 'border-[#caa044] bg-[#fff1c9]'
                : 'border-[#eadfca] bg-white hover:border-[#d4af37]'
            }`}
          >
            <input
              type="radio"
              name="importMode"
              value={mode}
              checked={selectedImportMode === mode}
              onChange={() => onImportModeChange(mode)}
              className="mt-1"
            />
            <span>
              <span className="font-semibold text-[#171a22]">{IMPORT_MODE_LABELS[mode]}</span>
              {analysis.recommendedImportMode === mode && (
                <span className="ml-2 text-xs font-semibold text-[#98711d]">Recommended</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

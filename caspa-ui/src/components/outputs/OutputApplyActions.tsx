import { Link } from 'react-router-dom';
import { Copy, Download, Loader2, PenLine, Sparkles, Wand2 } from 'lucide-react';
import type { OutputApplyCapabilities } from '../../lib/outputSemantics';

interface Props {
  projectId?: string;
  capabilities: OutputApplyCapabilities;
  onCopy: () => void;
  onContinue?: () => void;
  onGold?: () => void;
  onApply?: () => void;
  onAppend?: () => void;
  onSaveAsNewUnit?: () => void;
  onExportMarkdown?: () => void;
  continuePending?: boolean;
  goldPending?: boolean;
  applyPending?: boolean;
  appendPending?: boolean;
  newUnitPending?: boolean;
}

export function OutputApplyActions({
  projectId,
  capabilities,
  onCopy,
  onContinue,
  onGold,
  onApply,
  onAppend,
  onSaveAsNewUnit,
  onExportMarkdown,
  continuePending,
  goldPending,
  applyPending,
  appendPending,
  newUnitPending,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Apply & export</div>
      <p className="text-sm leading-6 text-muted">
        Outputs stay in the archive until you explicitly apply them. Original manuscript units are never overwritten silently.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          disabled={!capabilities.canCopy}
          className="btn-secondary text-sm"
        >
          <Copy className="h-4 w-4" /> Keep as output · Copy
        </button>
        {capabilities.canContinue && onContinue && (
          <button
            type="button"
            onClick={onContinue}
            disabled={continuePending}
            className="btn-primary text-sm"
          >
            {continuePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            Continue from this
          </button>
        )}
        {capabilities.canGoldPass && onGold && (
          <button
            type="button"
            onClick={onGold}
            disabled={goldPending}
            className="btn-secondary text-sm"
          >
            {goldPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Run Gold Pass
          </button>
        )}
        {capabilities.canApplyToChapter && onApply && (
          <button
            type="button"
            onClick={onApply}
            disabled={applyPending}
            className="btn-secondary text-sm"
          >
            {applyPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            Replace chapter text
          </button>
        )}
        {capabilities.canAppendToChapter && onAppend && (
          <button
            type="button"
            onClick={onAppend}
            disabled={appendPending}
            className="btn-secondary text-sm"
          >
            {appendPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            Append to chapter
          </button>
        )}
        {capabilities.canSaveAsNewUnit && onSaveAsNewUnit && (
          <button
            type="button"
            onClick={onSaveAsNewUnit}
            disabled={newUnitPending}
            className="btn-secondary text-sm"
          >
            {newUnitPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            Save as new section
          </button>
        )}
        {capabilities.canExportMarkdown && onExportMarkdown && (
          <button type="button" onClick={onExportMarkdown} className="btn-secondary text-sm">
            <Download className="h-4 w-4" /> Export Markdown
          </button>
        )}
        {capabilities.canOpenWorkbench && projectId && (
          <>
            <Link to={`/projects/${projectId}/outputs`} className="btn-secondary text-sm">
              Project outputs
            </Link>
            <Link to={`/projects/${projectId}/export`} className="btn-secondary text-sm">
              Export package
            </Link>
            <Link to={`/projects/${projectId}/bible`} className="btn-secondary text-sm">
              <Wand2 className="h-4 w-4" /> Bible
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

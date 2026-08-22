import React, { useMemo } from 'react';
import type { ProjectBriefLike } from '../services/commissionService';
import StudioToolBridge, { type StudioToolId } from './StudioToolBridge';
import ResearchLibrary from './ResearchLibrary';
import StoryBibleStudio from './StoryBibleStudio';
import PsychologyStudio from './PsychologyStudio';
import GoldRefinery from './GoldRefinery';
import RedPenStudio from './RedPenStudio';
import BookDesignStudio from './BookDesignStudio';
import PublishPack from './PublishPack';
import { findWorkspaceTool, isStudioToolId, type WorkspaceToolId } from '../services/workspaceCatalog';

type Props = {
  tool: WorkspaceToolId;
  brief: ProjectBriefLike;
  manuscript: string;
  onBriefChange: (patch: Partial<ProjectBriefLike>) => void;
  onManuscriptProposal: (text: string) => void;
  onNavigate: (tool: WorkspaceToolId | string) => void;
  onSave: () => void;
  onClose: () => void;
};

export default function WorkspaceToolHost({
  tool,
  brief,
  manuscript,
  onBriefChange,
  onManuscriptProposal,
  onNavigate,
  onSave,
  onClose,
}: Props) {
  const meta = findWorkspaceTool(tool);
  const body = useMemo(() => {
    if (isStudioToolId(tool)) {
      return (
        <StudioToolBridge
          embedded
          tool={tool as StudioToolId}
          brief={brief}
          draftPage={manuscript}
          onBriefChange={onBriefChange}
          onDraftChange={onManuscriptProposal}
          onNavigate={onNavigate}
        />
      );
    }
    if (tool === 'research') return <ResearchLibrary brief={brief} manuscriptText={manuscript} />;
    if (tool === 'bible') {
      return (
        <StoryBibleStudio
          brief={brief}
          onOpenWorkshop={() => onNavigate('workshop')}
          onOpenPsychology={() => onNavigate('psychology')}
          onOpenResearch={() => onNavigate('research')}
        />
      );
    }
    if (tool === 'psychology') return <PsychologyStudio brief={brief} manuscriptText={manuscript} />;
    if (tool === 'gold') return <GoldRefinery brief={brief} draftPage={manuscript} setDraftPage={onManuscriptProposal} />;
    if (tool === 'redpen') return <RedPenStudio brief={brief} draftPage={manuscript} onOpenWorkshop={() => onNavigate('workshop')} />;
    if (tool === 'design') return <BookDesignStudio brief={brief} draftPage={manuscript} onDraftChange={onManuscriptProposal} />;
    if (tool === 'publish') {
      return (
        <PublishPack
          brief={brief}
          authorEmail=""
          onGoWorkshop={() => onNavigate('workshop')}
          onGoDesign={() => onNavigate('design')}
        />
      );
    }
    return null;
  }, [tool, brief, manuscript, onBriefChange, onManuscriptProposal, onNavigate]);

  if (!body) return null;

  return (
    <section className="literary-card workspace-tool-host" data-testid="workspace-tool-host">
      <header className="workspace-tool-host-bar">
        <div>
          <p className="eyebrow">{meta?.label || tool}</p>
          <p className="workspace-help-copy">{meta?.help}</p>
        </div>
        <div className="desk-row">
          <button type="button" className="desk-ghost" onClick={onSave}>Save this work</button>
          <button type="button" className="desk-ghost" onClick={onClose}>Back to the page</button>
        </div>
      </header>
      <div className="workspace-tool-host-body">{body}</div>
    </section>
  );
}

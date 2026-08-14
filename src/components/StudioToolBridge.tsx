/**
 * Bridges ProjectBrief + commission storage into the full literary-tool surface
 * (Brainstorm, Character Forge, Plot, Rip & Fix, Critic Swarm, Scalpel, Pilot, etc.)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Character,
  Chapter,
  PlotNode,
  Project,
  ResearchNote,
  SourceMaterial,
  ViewType as LegacyViewType,
} from '../types';
import { briefToProject, type ProjectBriefLike } from '../services/commissionService';
import { getProjectKey, loadLibrary, addNote, removeNote } from '../services/researchLibraryService';
import {
  formatShowPackForWriting,
  hasShowBoxContent,
  loadShowBox,
  showBoxPieceCount,
} from '../services/showBoxService';

import Brainstorm from './Brainstorm';
import CharacterForge from './CharacterForge';
import PlotArchitect from './PlotArchitect';
import ManuscriptFixer from './ManuscriptFixer';
import CriticSwarm from './CriticSwarm';
import AutoDrafter from './AutoDrafter';
import ScalpelModule from './ScalpelModule';
import PilotSeatView from './PilotSeatView';
import IntelligenceLab from './IntelligenceLab';
import WritingStudio from './WritingStudio';
import { PrizeCalibrationDashboard } from './PrizeCalibrationDashboard';

export type StudioToolId =
  | 'brainstorm'
  | 'characters'
  | 'plot'
  | 'architect'
  | 'swarm'
  | 'autodraft'
  | 'scalpel'
  | 'pilot'
  | 'intelligence'
  | 'writing'
  | 'prizes';

const CANON_KEY = 'caspa.studioCanon';

type StudioCanon = {
  characters: Character[];
  plotNodes: PlotNode[];
  sourceMaterials: SourceMaterial[];
  critiques: Record<string, any[]>;
};

function loadCanon(projectKey: string): StudioCanon {
  try {
    const raw = localStorage.getItem(`${CANON_KEY}.${projectKey}`);
    if (!raw) return { characters: [], plotNodes: [], sourceMaterials: [], critiques: {} };
    const parsed = JSON.parse(raw);
    return {
      characters: parsed.characters || [],
      plotNodes: parsed.plotNodes || [],
      sourceMaterials: parsed.sourceMaterials || [],
      critiques: parsed.critiques || {},
    };
  } catch {
    return { characters: [], plotNodes: [], sourceMaterials: [], critiques: {} };
  }
}

function saveCanon(projectKey: string, canon: StudioCanon) {
  localStorage.setItem(`${CANON_KEY}.${projectKey}`, JSON.stringify(canon));
}

function loadCommissionChapters(): Chapter[] {
  try {
    const raw = localStorage.getItem('caspa.commission');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.chapters) ? parsed.chapters : [];
  } catch {
    return [];
  }
}

function persistCommissionChapters(chapters: Chapter[]) {
  try {
    const raw = localStorage.getItem('caspa.commission');
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.chapters = chapters;
    if (chapters.length) {
      parsed.artefact = chapters
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((c) => `# ${c.title}\n\n${c.content || ''}`.trim())
        .join('\n\n');
    }
    localStorage.setItem('caspa.commission', JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

interface Props {
  tool: StudioToolId;
  brief: ProjectBriefLike;
  draftPage: string;
  onBriefChange: (patch: Partial<ProjectBriefLike>) => void;
  onDraftChange: (text: string) => void;
  onNavigate: (legacyView: LegacyViewType | string) => void;
}

function assembleShowSource(brief: ProjectBriefLike): string {
  const pack = loadShowBox();
  return [
    `Show: ${brief.title}`,
    brief.idea,
    pack.runningOrder && `Running order:\n${pack.runningOrder}`,
    pack.songList && `Song list:\n${pack.songList}`,
    pack.castNotes && `Cast:\n${pack.castNotes}`,
    pack.musicSketch && `Music sketch:\n${pack.musicSketch}`,
    pack.productionPack && `Production pack:\n${pack.productionPack}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

const titles: Record<StudioToolId, { kicker: string; title: string; subtitle: string }> = {
  brainstorm: {
    kicker: 'Make',
    title: 'Brainstorm',
    subtitle: 'Pressure the premise. Find the wound, desire, and engine before you draft.',
  },
  characters: {
    kicker: 'Make',
    title: 'Character Forge',
    subtitle: 'Build people with wants, masks, and pressure points — not trait lists.',
  },
  plot: {
    kicker: 'Make',
    title: 'Plot Architect',
    subtitle: 'Hold the spine. Every node should turn power, knowledge, or danger.',
  },
  architect: {
    kicker: 'Improve',
    title: 'Rip & Fix',
    subtitle: 'Manuscript fixer — restructure, slow-cook, or liquidate a stuck draft.',
  },
  swarm: {
    kicker: 'Improve',
    title: 'Critic Swarm',
    subtitle: 'Multiple critical lenses on the same chapters. Accept only what earns its keep.',
  },
  autodraft: {
    kicker: 'Draft',
    title: 'Auto Drafter',
    subtitle: 'Deep-draft held chapters with style DNA and plot lattice.',
  },
  scalpel: {
    kicker: 'Improve',
    title: 'Scalpel',
    subtitle: 'Cut sludge. Keep tension. Aim for 25–40% reduction without losing the turn.',
  },
  pilot: {
    kicker: 'Steer',
    title: 'Pilot Seat',
    subtitle: 'Directive chat that proposes plot, character, and chapter changes you can commit.',
  },
  intelligence: {
    kicker: 'Research',
    title: 'Intelligence Lab',
    subtitle: 'Deep research, archives, and sensory grounding for the draft.',
  },
  writing: {
    kicker: 'Draft',
    title: 'Writing Studio',
    subtitle: 'Chapter-focused drafting room with the full literary engine behind it.',
  },
  prizes: {
    kicker: 'Calibrate',
    title: 'Prize Calibration',
    subtitle: 'Pressure-test the manuscript against prize lenses and craft dimensions.',
  },
};

export default function StudioToolBridge({
  tool,
  brief,
  draftPage,
  onBriefChange,
  onDraftChange,
  onNavigate,
}: Props) {
  const projectKey = getProjectKey(brief);
  const [canon, setCanon] = useState<StudioCanon>(() => loadCanon(projectKey));
  const [chapters, setChapters] = useState<Chapter[]>(() => loadCommissionChapters());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setCanon(loadCanon(projectKey));
    setChapters(loadCommissionChapters());
  }, [projectKey]);

  useEffect(() => {
    saveCanon(projectKey, canon);
  }, [projectKey, canon]);

  const flash = useCallback((msg: string, _type?: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3200);
  }, []);

  const project: Project = useMemo(() => {
    const base = briefToProject(brief);
    const showCtx = formatShowPackForWriting();
    const showSources: SourceMaterial[] = hasShowBoxContent()
      ? [
          {
            id: 'show-box-pack',
            name: 'Show in a Box pack',
            content: assembleShowSource(brief),
            type: 'production',
            updatedAt: Date.now(),
          },
        ]
      : [];
    const sourceMaterials = [
      ...canon.sourceMaterials.filter((s) => s.id !== 'show-box-pack'),
      ...showSources,
    ];
    return {
      ...base,
      characters: canon.characters,
      plotNodes: canon.plotNodes,
      chapters,
      research: loadLibrary(projectKey),
      sourceMaterials,
      critiques: canon.critiques,
      premise: showCtx ? `${brief.idea}\n\n${showCtx}` : brief.idea,
      tone: brief.tone,
      title: brief.title,
    };
  }, [brief, canon, chapters, projectKey]);

  const research = useMemo(() => loadLibrary(projectKey) as ResearchNote[], [projectKey, canon, notice]);
  const showPackMeta = showBoxPieceCount(loadShowBox());

  const updateProject = useCallback(
    async (updates: Partial<Project>) => {
      if (updates.title != null || updates.premise != null || updates.tone != null || updates.targetWordCount != null) {
        onBriefChange({
          ...(updates.title != null ? { title: updates.title } : {}),
          ...(updates.premise != null ? { idea: updates.premise } : {}),
          ...(updates.tone != null ? { tone: updates.tone } : {}),
          ...(updates.targetWordCount != null ? { targetWordCount: updates.targetWordCount } : {}),
        });
      }
      setCanon((prev) => ({
        characters: updates.characters ?? prev.characters,
        plotNodes: updates.plotNodes ?? prev.plotNodes,
        sourceMaterials: updates.sourceMaterials ?? prev.sourceMaterials,
        critiques: updates.critiques ?? prev.critiques,
      }));
      if (updates.chapters) {
        setChapters(updates.chapters);
        persistCommissionChapters(updates.chapters);
        const text = updates.chapters
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((c) => `# ${c.title}\n\n${c.content || ''}`.trim())
          .join('\n\n');
        if (text.trim()) onDraftChange(text);
      }
    },
    [onBriefChange, onDraftChange]
  );

  const updateChapters = useCallback(
    async (next: Chapter[]) => {
      setChapters(next);
      persistCommissionChapters(next);
      const text = next
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((c) => `# ${c.title}\n\n${c.content || ''}`.trim())
        .join('\n\n');
      if (text.trim()) onDraftChange(text);
    },
    [onDraftChange]
  );

  const updateCharacters = useCallback((chars: Character[]) => {
    setCanon((prev) => ({ ...prev, characters: chars }));
  }, []);

  const updatePlotNodes = useCallback(async (nodes: PlotNode[]) => {
    setCanon((prev) => ({ ...prev, plotNodes: nodes }));
  }, []);

  const onAddResearch = useCallback(
    async (note: ResearchNote) => {
      addNote(projectKey, note as any);
      flash('Research note saved', 'success');
    },
    [projectKey, flash]
  );

  const meta = titles[tool];
  const setLegacyView = useCallback(
    (v: LegacyViewType | string) => {
      onNavigate(v);
    },
    [onNavigate]
  );

  // Seed a single chapter from White Page when tools need chapters but Workshop hasn't run.
  useEffect(() => {
    if (chapters.length === 0 && draftPage.trim().length > 40 && (tool === 'swarm' || tool === 'scalpel' || tool === 'autodraft' || tool === 'writing' || tool === 'architect')) {
      const seeded: Chapter[] = [
        {
          id: 'seed-draft',
          title: 'Working draft',
          summary: brief.idea.slice(0, 160),
          content: draftPage,
          order: 1,
          plotNodeIds: [],
          tags: [],
          updatedAt: Date.now(),
        },
      ];
      setChapters(seeded);
      persistCommissionChapters(seeded);
    }
  }, [tool]); // intentionally once when opening a draft tool

  let body: React.ReactNode = null;

  if (tool === 'brainstorm') {
    body = (
      <Brainstorm
        project={project}
        research={research}
        sourceMaterials={canon.sourceMaterials}
        updateProject={(u) => {
          void updateProject(u);
        }}
        onAddResearch={onAddResearch}
        onError={(m) => flash(m, 'error')}
      />
    );
  } else if (tool === 'characters') {
    body = (
      <CharacterForge
        project={project}
        research={research}
        chapters={chapters}
        updateProject={(u) => {
          void updateProject(u);
        }}
        updateCharacters={updateCharacters}
        onError={(m) => flash(m, 'error')}
      />
    );
  } else if (tool === 'plot') {
    body = (
      <PlotArchitect
        project={project}
        plotNodes={canon.plotNodes}
        chapters={chapters}
        research={research}
        updateProject={(u) => {
          void updateProject(u);
        }}
        updatePlotNodes={(nodes) => {
          void updatePlotNodes(nodes);
        }}
        updateChapters={(ch) => {
          void updateChapters(ch);
        }}
        setView={setLegacyView}
        onNotify={flash}
        onError={(m) => flash(m, 'error')}
      />
    );
  } else if (tool === 'architect') {
    body = (
      <ManuscriptFixer
        project={project}
        chapters={chapters}
        research={research}
        updateProject={(u) => {
          void updateProject(u);
        }}
        updateChapters={(ch) => {
          void updateChapters(ch);
        }}
        updatePlotNodes={(nodes) => {
          void updatePlotNodes(nodes);
        }}
        onAddResearch={onAddResearch}
        setView={setLegacyView}
        onError={(m) => flash(m, 'error')}
      />
    );
  } else if (tool === 'swarm') {
    body = (
      <CriticSwarm
        projectType={project.type}
        maturity={project.maturity}
        chapters={chapters}
        sourceMaterials={canon.sourceMaterials}
        existingCritiques={canon.critiques}
        updateProject={(u) => {
          void updateProject(u);
        }}
        updateChapters={(ch) => {
          void updateChapters(ch);
        }}
        setView={setLegacyView}
        onError={(m) => flash(m, 'error')}
      />
    );
  } else if (tool === 'autodraft') {
    body = (
      <AutoDrafter
        project={project}
        chapters={chapters}
        plotNodes={canon.plotNodes}
        research={research}
        updateProject={updateProject}
        updateChapters={updateChapters}
        setView={setLegacyView}
        onNotify={flash}
        onError={(m) => flash(m, 'error')}
      />
    );
  } else if (tool === 'scalpel') {
    body = (
      <ScalpelModule
        project={project}
        chapters={chapters}
        updateProject={updateProject}
        updateChapters={updateChapters}
        setView={setLegacyView}
        onNotify={flash}
      />
    );
  } else if (tool === 'pilot') {
    body = (
      <PilotSeatView
        project={project}
        characters={canon.characters}
        plotNodes={canon.plotNodes}
        chapters={chapters}
        research={research}
        onSaveCharacter={async (c) => {
          setCanon((prev) => {
            const exists = prev.characters.some((x) => x.id === c.id);
            return {
              ...prev,
              characters: exists ? prev.characters.map((x) => (x.id === c.id ? c : x)) : [...prev.characters, c],
            };
          });
        }}
        onSavePlotNode={async (n) => {
          setCanon((prev) => {
            const exists = prev.plotNodes.some((x) => x.id === n.id);
            return {
              ...prev,
              plotNodes: exists ? prev.plotNodes.map((x) => (x.id === n.id ? n : x)) : [...prev.plotNodes, n],
            };
          });
        }}
        onAddResearch={onAddResearch}
        updateProject={updateProject}
        onNotify={flash}
      />
    );
  } else if (tool === 'intelligence') {
    body = (
      <IntelligenceLab
        project={project}
        research={research}
        chapters={chapters}
        sourceMaterials={canon.sourceMaterials}
        onAddResearch={onAddResearch}
        onDeleteResearch={async (id) => {
          removeNote(projectKey, id);
          flash('Note removed');
        }}
        onAddChapter={async (ch) => {
          const next = [...chapters, ch];
          await updateChapters(next);
        }}
        onAddSource={async (source) => {
          setCanon((prev) => ({ ...prev, sourceMaterials: [...prev.sourceMaterials, source] }));
        }}
        onDeleteSource={async (id) => {
          setCanon((prev) => ({
            ...prev,
            sourceMaterials: prev.sourceMaterials.filter((s) => s.id !== id),
          }));
        }}
        onNotify={flash}
      />
    );
  } else if (tool === 'writing') {
    body = (
      <WritingStudio
        project={project}
        plotNodes={canon.plotNodes}
        presence={[]}
        updateProject={(u) => {
          void updateProject(u);
        }}
        updateChapters={(ch) => {
          void updateChapters(ch);
        }}
        setView={setLegacyView}
        upsertChapter={(ch) => {
          const next = chapters.some((c) => c.id === ch.id)
            ? chapters.map((c) => (c.id === ch.id ? ch : c))
            : [...chapters, ch];
          void updateChapters(next);
        }}
        onDeleteChapter={(id) => {
          void updateChapters(chapters.filter((c) => c.id !== id));
        }}
        onUpsertSource={async (source) => {
          setCanon((prev) => {
            const exists = prev.sourceMaterials.some((s) => s.id === source.id);
            return {
              ...prev,
              sourceMaterials: exists
                ? prev.sourceMaterials.map((s) => (s.id === source.id ? source : s))
                : [...prev.sourceMaterials, source],
            };
          });
        }}
        onDeleteSource={(id) => {
          setCanon((prev) => ({
            ...prev,
            sourceMaterials: prev.sourceMaterials.filter((s) => s.id !== id),
          }));
        }}
        onUpsertCharacters={async (chars) => {
          updateCharacters(chars);
        }}
        onError={(m) => flash(m, 'error')}
      />
    );
  } else if (tool === 'prizes') {
    body = <PrizeCalibrationDashboard />;
  }

  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ color: '#9b6d16', fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            {meta.kicker}
          </div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1, letterSpacing: -1.5 }}>
            {meta.title}
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: '#73695d', fontSize: 16, lineHeight: 1.5 }}>{meta.subtitle}</p>
          <p style={{ margin: '10px 0 0', fontSize: 13, color: '#8a7a66' }}>
            Project: <strong style={{ color: '#4a3b28' }}>{brief.title}</strong>
            {chapters.length > 0 ? ` · ${chapters.length} chapters in Workshop` : ' · paste/diagnose in Workshop for chapter tools'}
            {showPackMeta.done > 0 ? ` · Show Box ${showPackMeta.done}/${showPackMeta.total}` : ''}
          </p>
        </div>
        {notice && (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              borderRadius: 14,
              background: '#fff8ea',
              border: '1px solid #eadfce',
              color: '#5b4724',
              fontWeight: 600,
            }}
          >
            {notice}
          </div>
        )}
        <div style={{ background: 'rgba(255,255,255,0.55)', borderRadius: 24, border: '1px solid #eadfce', padding: 8, ...(tool === 'swarm' ? { height: 'clamp(620px, calc(100vh - 250px), 900px)', minHeight: 0, overflow: 'hidden' } : {}) }}>
          {body}
        </div>
      </div>
    </section>
  );
}

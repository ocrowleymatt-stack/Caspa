/**
 * CourtBundleView.tsx
 * Two-way Shakespeare ↔ Nexus bridge + customisable court bundle / evidence document generator.
 *
 * Features:
 *  - Opens Nexus visualizer in a popup and sends the current project as a graph
 *  - Listens for GRAPH_UPDATED messages back from Nexus
 *  - Lets the user build a fully customisable document from Shakespeare + Nexus data
 *  - Supports Court Bundle, Evidence Manual, Witness Statement, and Custom formats
 *  - Editable sections, drag-to-reorder, AI narrative generation, and Markdown download
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Network, FileText, Download, RefreshCw, Plus, Trash2, GripVertical,
  ChevronDown, ChevronUp, Loader2, Eye, EyeOff, Wand2, Link2, CheckCircle2,
  AlertCircle, BookOpen, Users, GitBranch, FlaskConical, Scale, FileSearch
} from 'lucide-react';
import { Project, Chapter, ResearchNote, Character, PlotNode } from '../types';
import { AIService } from '../services/ai';

// ── Types ──────────────────────────────────────────────────────────────────────

interface NexusNode {
  id: string;
  name?: string;
  type?: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface NexusLink {
  source: string;
  target: string;
  relationship: string;
  confidence?: string;
}

interface NexusGraph {
  nodes: NexusNode[];
  links: NexusLink[];
  centralNode?: string;
  narrative?: string;
}

type SectionType =
  | 'cover'
  | 'toc'
  | 'executive_summary'
  | 'entity_index'
  | 'timeline'
  | 'relationship_map'
  | 'evidence_narrative'
  | 'chapters'
  | 'research_notes'
  | 'characters'
  | 'plot_nodes'
  | 'witness_statement'
  | 'hypothesis'
  | 'custom';

interface BundleSection {
  id: string;
  type: SectionType;
  title: string;
  enabled: boolean;
  content: string; // editable markdown content
  aiGenerated: boolean;
  generating: boolean;
}

type DocumentFormat = 'court_bundle' | 'evidence_manual' | 'witness_statement' | 'custom';

interface Props {
  project: Project;
  chapters: Chapter[];
  research: ResearchNote[];
  characters: Character[];
  plotNodes: PlotNode[];
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const NEXUS_URL = 'https://ais-pre-znj4lkahu7mebrpvsyiuoj-819232437603.europe-west2.run.app';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function projectToNexusGraph(
  project: Project,
  characters: Character[],
  plotNodes: PlotNode[],
  research: ResearchNote[]
): NexusGraph {
  const nodes: NexusNode[] = [];
  const links: NexusLink[] = [];

  // Central node — the project itself
  nodes.push({ id: `proj_${project.id}`, name: project.title, type: 'event', description: project.premise });

  // Characters → person nodes
  characters.forEach(c => {
    nodes.push({ id: `char_${c.id}`, name: c.name, type: 'person', description: `${c.role}. ${c.backstory?.slice(0, 200) || ''}` });
    links.push({ source: `proj_${project.id}`, target: `char_${c.id}`, relationship: c.role || 'character' });
  });

  // Plot nodes → event nodes
  plotNodes.forEach(p => {
    nodes.push({ id: `plot_${p.id}`, name: p.title, type: 'event', description: p.description });
    links.push({ source: `proj_${project.id}`, target: `plot_${p.id}`, relationship: p.type });
  });

  // Research → file/document nodes
  research.forEach(r => {
    nodes.push({ id: `res_${r.id}`, name: r.title, type: 'file', description: r.content.slice(0, 300) });
    links.push({ source: `proj_${project.id}`, target: `res_${r.id}`, relationship: r.category || 'research' });
  });

  // Cross-link characters to plot nodes they share
  characters.forEach(c => {
    plotNodes.forEach(p => {
      if (p.description.toLowerCase().includes(c.name.toLowerCase())) {
        links.push({ source: `char_${c.id}`, target: `plot_${p.id}`, relationship: 'involved_in' });
      }
    });
  });

  return { nodes, links, centralNode: `proj_${project.id}`, narrative: project.premise };
}

function defaultSectionsForFormat(format: DocumentFormat): BundleSection[] {
  const all: { type: SectionType; title: string }[] = [
    { type: 'cover', title: 'Cover Page' },
    { type: 'toc', title: 'Table of Contents' },
    { type: 'executive_summary', title: 'Executive Summary' },
    { type: 'entity_index', title: 'Entity Index' },
    { type: 'timeline', title: 'Timeline of Events' },
    { type: 'relationship_map', title: 'Relationship Map (Text)' },
    { type: 'evidence_narrative', title: 'Evidence Narrative' },
    { type: 'chapters', title: 'Written Chapters / Statements' },
    { type: 'research_notes', title: 'Research & Source Notes' },
    { type: 'characters', title: 'Character / Person Profiles' },
    { type: 'plot_nodes', title: 'Plot / Event Nodes' },
    { type: 'witness_statement', title: 'Witness Statement Template' },
    { type: 'hypothesis', title: 'Hypothesis & Analysis' },
  ];

  const enabledByFormat: Record<DocumentFormat, SectionType[]> = {
    court_bundle: ['cover', 'toc', 'executive_summary', 'entity_index', 'timeline', 'evidence_narrative', 'chapters', 'research_notes', 'witness_statement'],
    evidence_manual: ['cover', 'toc', 'executive_summary', 'entity_index', 'relationship_map', 'evidence_narrative', 'research_notes', 'characters', 'hypothesis'],
    witness_statement: ['cover', 'witness_statement', 'characters', 'timeline'],
    custom: all.map(s => s.type),
  };

  const enabled = enabledByFormat[format];
  return all.map(s => ({
    id: uid(),
    type: s.type,
    title: s.title,
    enabled: enabled.includes(s.type),
    content: '',
    aiGenerated: false,
    generating: false,
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CourtBundleView({ project, chapters, research, characters, plotNodes, onNotify }: Props) {
  const [nexusGraph, setNexusGraph] = useState<NexusGraph | null>(null);
  const [nexusConnected, setNexusConnected] = useState(false);
  const [nexusProjectName, setNexusProjectName] = useState<string>('');
  const nexusWindowRef = useRef<Window | null>(null);

  const [format, setFormat] = useState<DocumentFormat>('court_bundle');
  const [sections, setSections] = useState<BundleSection[]>(() => defaultSectionsForFormat('court_bundle'));
  const [documentTitle, setDocumentTitle] = useState(`${project.title} — Court Bundle`);
  const [caseRef, setCaseRef] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [preparedDate, setPreparedDate] = useState(new Date().toISOString().slice(0, 10));
  const [previewMode, setPreviewMode] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // ── Listen for GRAPH_UPDATED from Nexus ─────────────────────────────────────
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'GRAPH_UPDATED') {
        const { graph, projectName } = event.data;
        setNexusGraph(graph);
        setNexusConnected(true);
        if (projectName) setNexusProjectName(projectName);
        onNotify(`Nexus graph synced — ${graph.nodes.length} nodes, ${graph.links.length} links`, 'success');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onNotify]);

  // ── Open Nexus and push the project graph ───────────────────────────────────
  const openNexus = useCallback(() => {
    const graph = projectToNexusGraph(project, characters, plotNodes, research);
    const win = window.open(NEXUS_URL, 'nexus_visualizer', 'width=1400,height=900,noopener=0');
    if (!win) { onNotify('Popup blocked — please allow popups for this site', 'error'); return; }
    nexusWindowRef.current = win;

    // Wait for Nexus to load then push the graph
    const pushGraph = () => {
      win.postMessage({ command: 'LOAD_FULL_GRAPH', payload: { graph, projectName: project.title } }, '*');
    };
    // Try immediately and also after a delay in case the window is still loading
    setTimeout(pushGraph, 1500);
    setTimeout(pushGraph, 4000);
    onNotify('Opening Nexus visualizer…', 'info');
  }, [project, characters, plotNodes, research, onNotify]);

  // ── Change format ────────────────────────────────────────────────────────────
  const handleFormatChange = (f: DocumentFormat) => {
    setFormat(f);
    setSections(defaultSectionsForFormat(f));
    const titles: Record<DocumentFormat, string> = {
      court_bundle: `${project.title} — Court Bundle`,
      evidence_manual: `${project.title} — Evidence Manual`,
      witness_statement: `${project.title} — Witness Statement`,
      custom: `${project.title} — Document`,
    };
    setDocumentTitle(titles[f]);
  };

  // ── Toggle section ───────────────────────────────────────────────────────────
  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  // ── Update section content ───────────────────────────────────────────────────
  const updateContent = (id: string, content: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, content } : s));
  };

  // ── Add custom section ───────────────────────────────────────────────────────
  const addCustomSection = () => {
    setSections(prev => [...prev, {
      id: uid(), type: 'custom', title: 'Custom Section', enabled: true,
      content: '', aiGenerated: false, generating: false,
    }]);
  };

  // ── Drag to reorder ──────────────────────────────────────────────────────────
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setSections(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(index);
  };
  const handleDragEnd = () => setDragIndex(null);

  // ── AI generate content for a single section ─────────────────────────────────
  const generateSection = async (id: string) => {
    const section = sections.find(s => s.id === id);
    if (!section) return;
    setSections(prev => prev.map(s => s.id === id ? { ...s, generating: true } : s));

    const graphSummary = nexusGraph
      ? `\n\nNEXUS INTELLIGENCE GRAPH (${nexusGraph.nodes.length} nodes, ${nexusGraph.links.length} links):\nNodes: ${nexusGraph.nodes.slice(0, 20).map(n => `${n.name} (${n.type})`).join(', ')}${nexusGraph.nodes.length > 20 ? '...' : ''}\nKey relationships: ${nexusGraph.links.slice(0, 15).map(l => `${l.source} → ${l.target} [${l.relationship}]`).join('; ')}`
      : '';

    const projectContext = `Project: "${project.title}" (${project.type}, ${project.genre})
Premise: ${project.premise}
Characters: ${characters.map(c => c.name).join(', ')}
Plot nodes: ${plotNodes.map(p => p.title).join(', ')}
Research notes: ${research.length} notes${graphSummary}`;

    const prompts: Partial<Record<SectionType, string>> = {
      executive_summary: `Write a concise, authoritative executive summary for a ${format.replace('_', ' ')} titled "${documentTitle}". Case ref: ${caseRef || 'N/A'}. Prepared by: ${preparedBy || 'N/A'}.\n\n${projectContext}\n\nWrite in formal legal/professional prose. 3-4 paragraphs. No bullet points. No AI-style phrasing.`,
      entity_index: `Generate a formal entity index for this document. List every person, organisation, location, and key event. For each, provide: name, type, brief description, and significance to the case.\n\n${projectContext}\n\nFormat as a clean Markdown table with columns: Entity | Type | Description | Significance.`,
      timeline: `Construct a detailed chronological timeline of events from the following project data. Each entry should have: Date/Period | Event | Key Parties | Significance.\n\n${projectContext}\n\nFormat as a Markdown table. Be precise. Do not invent dates — use "Unspecified" where unknown.`,
      relationship_map: `Describe the key relationships between entities in this case as a structured text relationship map. Group by: (1) Personal relationships, (2) Organisational links, (3) Event connections.\n\n${projectContext}\n\nWrite in formal prose with sub-headings. No bullet points.`,
      evidence_narrative: `Write a formal evidence narrative for this ${format.replace('_', ' ')}. This should read as a coherent, authoritative account that synthesises all available intelligence — characters, events, research, and graph data — into a compelling and factually grounded narrative.\n\n${projectContext}\n\nUse formal legal/academic prose. Use section sub-headings. Cite sources where possible. Avoid AI-style phrasing.`,
      witness_statement: `Draft a formal witness statement template based on the following case data. Include: (1) Statement of Truth, (2) Personal details section (to be completed), (3) Chronological account of events, (4) Supporting evidence references, (5) Declaration.\n\n${projectContext}\n\nFormat for UK court use. Use formal legal language.`,
      hypothesis: `Analyse the available evidence and generate a structured hypothesis assessment. Include: (1) Primary hypothesis, (2) Supporting evidence, (3) Contradicting evidence, (4) Alternative hypotheses, (5) Confidence assessment.\n\n${projectContext}\n\nWrite in formal analytical prose.`,
      custom: `Generate professional content for a section titled "${section.title}" in a ${format.replace('_', ' ')} document.\n\n${projectContext}\n\nWrite in formal prose appropriate for legal/professional use.`,
    };

    const prompt = prompts[section.type] || prompts.custom!;

    try {
      const result = await AIService.callAI({ prompt, model: 'gemini-2.5-pro-preview-05-06', maxTokens: 2000 });
      setSections(prev => prev.map(s => s.id === id ? { ...s, content: result || '', aiGenerated: true, generating: false } : s));
    } catch (err: any) {
      onNotify(`Failed to generate "${section.title}": ${err.message}`, 'error');
      setSections(prev => prev.map(s => s.id === id ? { ...s, generating: false } : s));
    }
  };

  // ── AI generate all enabled sections ─────────────────────────────────────────
  const generateAll = async () => {
    setGeneratingAll(true);
    const autoGenTypes: SectionType[] = ['executive_summary', 'entity_index', 'timeline', 'relationship_map', 'evidence_narrative', 'witness_statement', 'hypothesis'];
    const toGenerate = sections.filter(s => s.enabled && autoGenTypes.includes(s.type) && !s.content);
    for (const s of toGenerate) {
      await generateSection(s.id);
    }
    setGeneratingAll(false);
    onNotify('All sections generated', 'success');
  };

  // ── Build static sections (no AI needed) ─────────────────────────────────────
  const buildStaticContent = useCallback((section: BundleSection): string => {
    if (section.content) return section.content;

    switch (section.type) {
      case 'cover':
        return `# ${documentTitle}\n\n**Case Reference:** ${caseRef || '—'}\n**Prepared by:** ${preparedBy || '—'}\n**Date:** ${preparedDate}\n**Classification:** CONFIDENTIAL\n\n---\n\n*This document has been prepared using Shakespeare (NovelWrite Pro) in conjunction with Nexus Intelligence Graph.*`;

      case 'toc':
        return `# Table of Contents\n\n${sections.filter(s => s.enabled && s.type !== 'toc').map((s, i) => `${i + 1}. ${s.title}`).join('\n')}`;

      case 'chapters':
        if (!chapters.length) return '*No chapters available.*';
        return chapters.map((c, i) =>
          `## ${i + 1}. ${c.title}\n\n${c.summary ? `**Summary:** ${c.summary}\n\n` : ''}${c.content || '*No content.*'}`
        ).join('\n\n---\n\n');

      case 'research_notes':
        if (!research.length) return '*No research notes available.*';
        return research.map(r =>
          `### ${r.title}\n**Category:** ${r.category}${r.source ? `\n**Source:** ${r.source}` : ''}\n\n${r.content}`
        ).join('\n\n---\n\n');

      case 'characters':
        if (!characters.length) return '*No character profiles available.*';
        return characters.map(c =>
          `### ${c.name}\n**Role:** ${c.role}\n\n${c.backstory || ''}\n\n${c.traits?.length ? `**Traits:** ${c.traits.join(', ')}` : ''}`
        ).join('\n\n---\n\n');

      case 'plot_nodes':
        if (!plotNodes.length) return '*No plot nodes available.*';
        return plotNodes.map(p =>
          `### ${p.title}\n**Type:** ${p.type} | **Status:** ${p.status}\n\n${p.description}`
        ).join('\n\n---\n\n');

      default:
        return '';
    }
  }, [documentTitle, caseRef, preparedBy, preparedDate, sections, chapters, research, characters, plotNodes]);

  // ── Download as Markdown ──────────────────────────────────────────────────────
  const downloadMarkdown = () => {
    const body = sections
      .filter(s => s.enabled)
      .map(s => {
        const content = buildStaticContent(s);
        return `# ${s.title}\n\n${content}`;
      })
      .join('\n\n---\n\n');

    const full = `${body}\n\n---\n\n*Generated by Shakespeare × Nexus on ${new Date().toLocaleString()}*`;
    const blob = new Blob([full], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentTitle.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Document downloaded as Markdown', 'success');
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const formatLabels: Record<DocumentFormat, string> = {
    court_bundle: 'Court Bundle',
    evidence_manual: 'Evidence Manual',
    witness_statement: 'Witness Statement',
    custom: 'Custom Document',
  };

  const sectionIcons: Partial<Record<SectionType, React.ReactNode>> = {
    cover: <FileText size={14} />,
    toc: <BookOpen size={14} />,
    executive_summary: <Scale size={14} />,
    entity_index: <Users size={14} />,
    timeline: <GitBranch size={14} />,
    relationship_map: <Network size={14} />,
    evidence_narrative: <FileSearch size={14} />,
    chapters: <BookOpen size={14} />,
    research_notes: <FlaskConical size={14} />,
    characters: <Users size={14} />,
    plot_nodes: <GitBranch size={14} />,
    witness_statement: <Scale size={14} />,
    hypothesis: <FlaskConical size={14} />,
    custom: <FileText size={14} />,
  };

  return (
    <div className="flex flex-col h-full bg-surface-bg text-text-primary overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border-subtle px-6 py-4 flex items-center justify-between bg-surface-card">
        <div className="flex items-center gap-3">
          <Scale size={20} className="text-brand-primary" />
          <div>
            <h2 className="text-sm font-bold text-text-primary">Evidence Bundle Generator</h2>
            <p className="text-xs text-text-muted">Shakespeare × Nexus — Customisable legal document builder</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Nexus connection status */}
          <button
            onClick={openNexus}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              nexusConnected
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary hover:bg-brand-primary/20'
            }`}
          >
            <Network size={13} />
            {nexusConnected ? `Nexus Synced (${nexusGraph?.nodes.length || 0} nodes)` : 'Open in Nexus'}
          </button>
          <button
            onClick={generateAll}
            disabled={generatingAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50 transition-all"
          >
            {generatingAll ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
            Generate All
          </button>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border-subtle hover:bg-surface-hover transition-all"
          >
            {previewMode ? <EyeOff size={13} /> : <Eye size={13} />}
            {previewMode ? 'Edit' : 'Preview'}
          </button>
          <button
            onClick={downloadMarkdown}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border-subtle hover:bg-surface-hover transition-all"
          >
            <Download size={13} />
            Download
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel — settings & section list */}
        <div className="w-80 shrink-0 border-r border-border-subtle flex flex-col overflow-hidden bg-surface-card">
          {/* Document settings */}
          <div className="p-4 border-b border-border-subtle space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-1 block">Format</label>
              <div className="grid grid-cols-2 gap-1">
                {(Object.keys(formatLabels) as DocumentFormat[]).map(f => (
                  <button
                    key={f}
                    onClick={() => handleFormatChange(f)}
                    className={`text-[10px] font-semibold py-1.5 px-2 rounded-lg border transition-all ${
                      format === f
                        ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary'
                        : 'border-border-subtle text-text-muted hover:bg-surface-hover'
                    }`}
                  >
                    {formatLabels[f]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-1 block">Document Title</label>
              <input
                value={documentTitle}
                onChange={e => setDocumentTitle(e.target.value)}
                className="w-full bg-surface-bg border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-1 block">Case Ref</label>
                <input
                  value={caseRef}
                  onChange={e => setCaseRef(e.target.value)}
                  placeholder="e.g. CR-2026-001"
                  className="w-full bg-surface-bg border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-primary/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-1 block">Date</label>
                <input
                  type="date"
                  value={preparedDate}
                  onChange={e => setPreparedDate(e.target.value)}
                  className="w-full bg-surface-bg border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-primary/50"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-1 block">Prepared By</label>
              <input
                value={preparedBy}
                onChange={e => setPreparedBy(e.target.value)}
                placeholder="Name / Organisation"
                className="w-full bg-surface-bg border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-primary/50"
              />
            </div>
          </div>

          {/* Nexus graph info */}
          {nexusConnected && nexusGraph && (
            <div className="px-4 py-3 border-b border-border-subtle bg-green-500/5">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={12} className="text-green-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-green-400">Nexus Graph Loaded</span>
              </div>
              <p className="text-[10px] text-text-muted">{nexusGraph.nodes.length} entities · {nexusGraph.links.length} relationships{nexusProjectName ? ` · "${nexusProjectName}"` : ''}</p>
            </div>
          )}

          {/* Section list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">Sections</span>
              <button onClick={addCustomSection} className="flex items-center gap-1 text-[10px] text-brand-primary hover:underline">
                <Plus size={11} /> Add
              </button>
            </div>
            {sections.map((section, index) => (
              <div
                key={section.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={e => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 px-2 py-2 rounded-lg border transition-all cursor-grab ${
                  section.enabled
                    ? 'border-border-subtle bg-surface-bg hover:bg-surface-hover'
                    : 'border-transparent bg-transparent opacity-40'
                } ${dragIndex === index ? 'opacity-50 scale-95' : ''}`}
              >
                <GripVertical size={12} className="text-text-muted shrink-0" />
                <button onClick={() => toggleSection(section.id)} className="shrink-0">
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                    section.enabled ? 'bg-brand-primary border-brand-primary' : 'border-border-subtle'
                  }`}>
                    {section.enabled && <CheckCircle2 size={10} className="text-white" />}
                  </div>
                </button>
                <span className="text-text-muted shrink-0">{sectionIcons[section.type]}</span>
                <span className="text-[11px] text-text-primary flex-1 truncate">{section.title}</span>
                {section.aiGenerated && <Wand2 size={10} className="text-brand-primary shrink-0" />}
                {section.generating && <Loader2 size={10} className="animate-spin text-brand-primary shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — section editors / preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {previewMode ? (
            // Preview mode — render all enabled sections as formatted text
            <div className="max-w-4xl mx-auto space-y-8 font-serif">
              <div className="text-center border-b border-border-subtle pb-6">
                <h1 className="text-2xl font-bold text-text-primary">{documentTitle}</h1>
                {caseRef && <p className="text-sm text-text-muted mt-1">Case Ref: {caseRef}</p>}
                {preparedBy && <p className="text-sm text-text-muted">Prepared by: {preparedBy}</p>}
                <p className="text-sm text-text-muted">{preparedDate}</p>
              </div>
              {sections.filter(s => s.enabled).map(s => (
                <div key={s.id} className="space-y-2">
                  <h2 className="text-lg font-bold text-text-primary border-b border-border-subtle pb-1">{s.title}</h2>
                  <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {buildStaticContent(s) || <span className="text-text-muted italic">No content yet. Click "Generate" or type below.</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Edit mode — show each enabled section as an editable card
            sections.filter(s => s.enabled).map(section => (
              <SectionEditor
                key={section.id}
                section={section}
                staticContent={buildStaticContent(section)}
                onGenerate={() => generateSection(section.id)}
                onUpdate={(content) => updateContent(section.id, content)}
                onRename={(title) => setSections(prev => prev.map(s => s.id === section.id ? { ...s, title } : s))}
                onRemove={() => setSections(prev => prev.filter(s => s.id !== section.id))}
                icon={sectionIcons[section.type]}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section Editor sub-component ──────────────────────────────────────────────

interface SectionEditorProps {
  section: BundleSection;
  staticContent: string;
  onGenerate: () => void;
  onUpdate: (content: string) => void;
  onRename: (title: string) => void;
  onRemove: () => void;
  icon?: React.ReactNode;
}

function SectionEditor({ section, staticContent, onGenerate, onUpdate, onRename, onRemove, icon }: SectionEditorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const displayContent = section.content || staticContent;

  return (
    <div className="border border-border-subtle rounded-xl overflow-hidden bg-surface-card">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-surface-hover border-b border-border-subtle">
        <span className="text-text-muted">{icon}</span>
        {editingTitle ? (
          <input
            autoFocus
            value={section.title}
            onChange={e => onRename(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)}
            className="flex-1 bg-transparent border-b border-brand-primary text-sm font-semibold text-text-primary focus:outline-none"
          />
        ) : (
          <button onClick={() => setEditingTitle(true)} className="flex-1 text-left text-sm font-semibold text-text-primary hover:text-brand-primary transition-colors">
            {section.title}
          </button>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {section.aiGenerated && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">AI</span>
          )}
          <button
            onClick={onGenerate}
            disabled={section.generating}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-brand-primary hover:bg-brand-primary/10 transition-all disabled:opacity-50"
          >
            {section.generating ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
            {section.generating ? 'Generating…' : 'Generate'}
          </button>
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 text-text-muted hover:text-text-primary transition-colors">
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button onClick={onRemove} className="p-1 text-text-muted hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {/* Section body */}
      {!collapsed && (
        <textarea
          value={displayContent}
          onChange={e => onUpdate(e.target.value)}
          placeholder={`Content for "${section.title}" will appear here. Click Generate to use AI, or type directly.`}
          className="w-full min-h-[180px] p-4 bg-surface-bg text-sm text-text-primary font-mono leading-relaxed resize-y focus:outline-none placeholder:text-text-muted/40"
        />
      )}
    </div>
  );
}

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Project, Character, PlotNode, Chapter, ResearchNote
} from '../types';
import {
  Navigation2, Zap, Check, X, ChevronDown, ChevronUp,
  AlertTriangle, BookOpen, Users, GitBranch, FileText,
  Loader2, Send, Sparkles, Trash2, Search, Globe
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChangeType =
  | 'plot_add' | 'plot_modify'
  | 'character_add' | 'character_modify'
  | 'chapter_modify'
  | 'research_add'
  | 'project_update';

interface DirectiveChange {
  id: string;
  type: ChangeType;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  data: any;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  changes?: (DirectiveChange & { accepted: boolean | null; committed?: boolean })[];
  timestamp: number;
  thinking?: boolean;
  researching?: boolean;   // AI is running live web search
  researchReply?: string;  // synthesis message to follow
}

// ─── Constants ─────────────────────────────────────────────────────────────

const CHANGE_META: Record<ChangeType, { label: string; color: string; icon: React.ElementType }> = {
  plot_add:          { label: 'New Plot Thread',   color: 'text-violet-400 bg-violet-400/10 border-violet-400/30', icon: GitBranch },
  plot_modify:       { label: 'Plot Change',       color: 'text-purple-400 bg-purple-400/10 border-purple-400/30', icon: GitBranch },
  character_add:     { label: 'New Character',     color: 'text-sky-400 bg-sky-400/10 border-sky-400/30',         icon: Users },
  character_modify:  { label: 'Character Arc',     color: 'text-blue-400 bg-blue-400/10 border-blue-400/30',      icon: Users },
  chapter_modify:    { label: 'Chapter Redirect',  color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',   icon: BookOpen },
  research_add:      { label: 'Research Note',     color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', icon: FileText },
  project_update:    { label: 'Book-Level Change', color: 'text-rose-400 bg-rose-400/10 border-rose-400/30',      icon: Sparkles },
};

const IMPACT_COLOR: Record<string, string> = {
  low:    'text-emerald-400',
  medium: 'text-amber-400',
  high:   'text-rose-400',
};

const STARTERS = [
  "What would make this story more unpredictable?",
  "The protagonist feels weak — how do we give them more agency?",
  "I want to add a twist that recontextualises everything before it",
  "Kill the mentor and give me the consequences",
  "Make the antagonist more complex — right now they're too one-note",
  "I want the ending to feel earned but unexpected",
  "Research the historical setting for this story",
  "What psychological archetype is my protagonist following?",
];

// ─── Component ───────────────────────────────────────────────────────────────

interface PilotSeatProps {
  project: Project;
  characters: Character[];
  plotNodes: PlotNode[];
  chapters: Chapter[];
  research: ResearchNote[];
  onSaveCharacter: (c: Character) => Promise<void>;
  onSavePlotNode: (n: PlotNode) => Promise<void>;
  onAddResearch: (n: ResearchNote) => Promise<void>;
  updateProject: (patch: Partial<Project>) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function PilotSeatView({
  project, characters, plotNodes, chapters, research,
  onSaveCharacter, onSavePlotNode, onAddResearch, updateProject, onNotify,
}: PilotSeatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [expandedChangeId, setExpandedChangeId] = useState<string | null>(null);
  const [committedCount, setCommittedCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Init greeting ──────────────────────────────────────────────────────────
  useEffect(() => {
    const charCount = characters.length;
    const plotCount = plotNodes.length;
    const chapCount = chapters.length;

    const greeting = project.title
      ? `I've loaded **${project.title}** — ${charCount} character${charCount !== 1 ? 's' : ''}, ${plotCount} plot thread${plotCount !== 1 ? 's' : ''}, ${chapCount} chapter${chapCount !== 1 ? 's' : ''}.\n\nThis is your Pilot Seat. Talk to me like a co-author. Throw ideas, problems, questions — and when we land on something good, I'll propose the structural changes. If I need real-world facts to back up a story decision, I'll go and find them. You pick what to keep and commit when you're ready.`
      : `Welcome to the Pilot Seat. Open a project and I can help you steer the architecture of your book.`;

    setMessages([{
      id: 'init',
      role: 'ai',
      content: greeting,
      timestamp: Date.now(),
    }]);
  }, []);

  // ── Auto scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Build context snapshot ─────────────────────────────────────────────────
  const buildContext = useCallback(() => ({
    project: {
      id: project.id,
      title: project.title,
      type: project.type,
      genre: project.genre,
      premise: project.premise,
      tone: project.tone,
    },
    characters: characters.map(c => ({
      id: c.id, name: c.name, role: c.role,
      backstory: c.backstory?.slice(0, 300),
      traits: c.traits, goals: c.goals, fears: c.fears,
      archetype: c.archetype,
    })),
    plotNodes: plotNodes.map(n => ({
      id: n.id, title: n.title,
      description: n.description?.slice(0, 200),
      type: n.type, status: n.status, order: n.order,
    })),
    chapters: chapters.map(ch => ({
      id: ch.id, title: ch.title,
      summary: ch.summary?.slice(0, 200),
      order: ch.order, status: ch.status,
    })),
    research: research.map(r => ({
      id: r.id, title: r.title,
      category: r.category, tags: r.tags,
      content: r.content?.slice(0, 100),
    })),
  }), [project, characters, plotNodes, chapters, research]);

  // ── Send message ───────────────────────────────────────────────────────────
  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const thinkingMsg: ChatMessage = {
      id: `thinking-${Date.now()}`,
      role: 'ai',
      content: '',
      timestamp: Date.now(),
      thinking: true,
    };

    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setInput('');
    setSending(true);

    try {
      const history = [...messages, userMsg]
        .filter(m => !m.thinking && !m.researching && m.id !== 'init')
        .map(m => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.content,
        }));

      const res = await fetch('/api/ai/pilot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          context: buildContext(),
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data: {
        reply: string;
        changes?: DirectiveChange[];
        researching?: boolean;
        researchReply?: string;
      } = await res.json();

      if (data.researching) {
        // AI is doing research — show a special research bubble, then the synthesis
        const researchBubble: ChatMessage = {
          id: `research-${Date.now()}`,
          role: 'ai',
          content: data.reply,
          researching: true,
          timestamp: Date.now(),
        };

        const synthesisMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'ai',
          content: data.researchReply || 'Research complete — notes staged below.',
          changes: data.changes?.map(c => ({ ...c, accepted: null })),
          timestamp: Date.now(),
        };

        setMessages(prev => [
          ...prev.map(m => m.thinking ? researchBubble : m),
          synthesisMsg,
        ]);
      } else {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'ai',
          content: data.reply,
          changes: data.changes?.map(c => ({ ...c, accepted: null })),
          timestamp: Date.now(),
        };
        setMessages(prev => prev.map(m => m.thinking ? aiMsg : m));
      }
    } catch (e: any) {
      setMessages(prev => prev.map(m => m.thinking ? {
        ...m,
        thinking: false,
        content: `Sorry, something went wrong: ${e.message || 'Unknown error'}`,
      } : m));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // ── Toggle change acceptance ───────────────────────────────────────────────
  const toggleChange = (msgId: string, changeId: string, val: boolean) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      return {
        ...m,
        changes: m.changes?.map(c =>
          c.id === changeId ? { ...c, accepted: c.accepted === val ? null : val } : c
        ),
      };
    }));
  };

  // ── Staged changes ─────────────────────────────────────────────────────────
  const stagedChanges = messages.flatMap(m =>
    (m.changes || []).filter(c => c.accepted === true).map(c => ({ ...c, msgId: m.id }))
  );

  // ── Commit ─────────────────────────────────────────────────────────────────
  const commit = async () => {
    if (!stagedChanges.length) return;
    setCommitting(true);
    let count = 0;

    for (const change of stagedChanges) {
      try {
        const d = change.data;
        if (change.type === 'character_add' || change.type === 'character_modify') {
          const existing = characters.find(c => c.id === d.id || c.name?.toLowerCase() === d.name?.toLowerCase());
          await onSaveCharacter({
            id: d.id || `char-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            updatedAt: Date.now(),
            traits: [], goals: [], fears: [], motivations: [], quirks: [],
            ...(existing || {}),
            ...d,
          });
        }
        if (change.type === 'plot_add' || change.type === 'plot_modify') {
          const existing = plotNodes.find(n => n.id === d.id || n.title?.toLowerCase() === d.title?.toLowerCase());
          await onSavePlotNode({
            id: d.id || `node-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            updatedAt: Date.now(),
            status: 'active', type: 'sub',
            order: plotNodes.length + count,
            ...(existing || {}),
            ...d,
          });
        }
        if (change.type === 'research_add') {
          await onAddResearch({
            id: d.id || `res-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            updatedAt: Date.now(),
            tags: [], category: 'Pilot Seat Research',
            ...d,
          });
        }
        if (change.type === 'project_update') {
          await updateProject(d);
        }
        count++;
      } catch (e) {
        console.error('Failed to commit change:', change.id, e);
      }
    }

    setMessages(prev => prev.map(m => ({
      ...m,
      changes: m.changes?.map(c => c.accepted === true ? { ...c, accepted: null, committed: true } : c),
    })));

    setCommittedCount(prev => prev + count);
    setCommitting(false);
    onNotify(`${count} change${count !== 1 ? 's' : ''} committed to your book`, 'success');

    setMessages(prev => [...prev, {
      id: `confirm-${Date.now()}`,
      role: 'ai',
      content: `Done — ${count} change${count !== 1 ? 's' : ''} committed to the manuscript. Keep going, or ask me to review the full picture.`,
      timestamp: Date.now(),
    }]);
  };

  // ── Clear ──────────────────────────────────────────────────────────────────
  const clearChat = () => {
    setMessages([{
      id: 'init-reset',
      role: 'ai',
      content: `Fresh session. What do you want to change?`,
      timestamp: Date.now(),
    }]);
    setCommittedCount(0);
  };

  // ─── Render message ────────────────────────────────────────────────────────
  const renderMessage = (msg: ChatMessage) => {
    // Thinking bubble
    if (msg.thinking) {
      return (
        <div key={msg.id} className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center shrink-0 mt-0.5">
            <Navigation2 className="w-4 h-4 text-brand-primary" />
          </div>
          <div className="bg-bg-secondary border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-brand-primary/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      );
    }

    // Research-in-progress bubble
    if (msg.researching) {
      return (
        <div key={msg.id} className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <Globe className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="bg-bg-secondary border border-emerald-500/20 rounded-2xl rounded-tl-sm px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Search className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">Live Research</span>
            </div>
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      );
    }

    // User bubble
    if (msg.role === 'user') {
      return (
        <div key={msg.id} className="flex items-start gap-3 justify-end">
          <div className="max-w-[80%] bg-brand-primary/15 border border-brand-primary/25 rounded-2xl rounded-tr-sm px-4 py-3">
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-text-secondary">
            M
          </div>
        </div>
      );
    }

    // AI bubble
    return (
      <div key={msg.id} className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center shrink-0 mt-0.5">
          <Navigation2 className="w-4 h-4 text-brand-primary" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Text */}
          <div className="bg-bg-secondary border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {msg.content.split('**').map((part, i) =>
                i % 2 === 1
                  ? <strong key={i} className="text-text-primary font-semibold">{part}</strong>
                  : part
              )}
            </p>
          </div>

          {/* Change cards */}
          {msg.changes && msg.changes.length > 0 && (
            <div className="flex flex-col gap-2 pl-1">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary/50">
                  {msg.changes.length} proposed change{msg.changes.length !== 1 ? 's' : ''}
                </span>
                <div className="h-px flex-1 bg-white/5" />
              </div>

              {/* Bulk accept/reject for 2+ cards */}
              {msg.changes.length >= 2 && !msg.changes.every(c => c.committed) && (
                <div className="flex items-center gap-2 mb-0.5">
                  <button
                    onClick={() => msg.changes?.forEach(c => !c.committed && toggleChange(msg.id, c.id, true))}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-full text-emerald-400 transition-all"
                  >
                    <Check className="w-2.5 h-2.5" /> Accept all
                  </button>
                  <button
                    onClick={() => msg.changes?.forEach(c => !c.committed && toggleChange(msg.id, c.id, false))}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-full text-red-400 transition-all"
                  >
                    <X className="w-2.5 h-2.5" /> Reject all
                  </button>
                </div>
              )}

              {msg.changes.map((change: any) => {
                const meta = CHANGE_META[change.type as ChangeType];
                const Icon = meta?.icon || Sparkles;
                const isOpen = expandedChangeId === `${msg.id}-${change.id}`;
                const isCommitted = change.committed;
                const isResearchCard = change.type === 'research_add';

                return (
                  <div
                    key={change.id}
                    className={`bg-bg-primary border rounded-xl overflow-hidden transition-all ${
                      isCommitted          ? 'border-emerald-500/20 opacity-60' :
                      change.accepted === true  ? 'border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.07)]' :
                      change.accepted === false ? 'border-red-500/20 opacity-40' :
                      isResearchCard       ? 'border-emerald-400/20 hover:border-emerald-400/40' :
                      'border-white/8 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                      {meta && (
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${meta.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {meta && (
                            <span className={`text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded border ${meta.color}`}>
                              {meta.label}
                            </span>
                          )}
                          {change.data?.source && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded border text-emerald-400/70 bg-emerald-400/5 border-emerald-400/20 flex items-center gap-0.5">
                              <Globe className="w-2 h-2" /> {change.data.source}
                            </span>
                          )}
                          <span className={`text-[9px] font-semibold uppercase ${IMPACT_COLOR[change.impact] || 'text-text-secondary'}`}>
                            {change.impact}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-text-primary mt-0.5 truncate">{change.title}</p>
                      </div>

                      {!isCommitted && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleChange(msg.id, change.id, true)}
                            title="Accept"
                            className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                              change.accepted === true
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'bg-white/5 border-white/10 text-text-secondary hover:border-emerald-500/50 hover:text-emerald-400'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleChange(msg.id, change.id, false)}
                            title="Reject"
                            className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                              change.accepted === false
                                ? 'bg-red-500 border-red-500 text-white'
                                : 'bg-white/5 border-white/10 text-text-secondary hover:border-red-500/50 hover:text-red-400'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setExpandedChangeId(isOpen ? null : `${msg.id}-${change.id}`)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 text-text-secondary hover:bg-white/10 transition-all"
                          >
                            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}

                      {isCommitted && (
                        <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-semibold shrink-0">
                          <Check className="w-3 h-3" /> committed
                        </div>
                      )}
                    </div>

                    <div className="px-3 pb-2.5">
                      <p className="text-[11px] text-text-secondary leading-relaxed">{change.description}</p>
                    </div>

                    {isOpen && (
                      <div className="border-t border-white/5 px-3 py-2.5">
                        {isResearchCard && change.data?.content ? (
                          <>
                            <p className="text-[9px] font-semibold uppercase tracking-widest text-emerald-400/60 mb-1.5">Research Content</p>
                            <p className="text-[11px] text-text-secondary leading-relaxed max-h-60 overflow-y-auto">
                              {change.data.content}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-[9px] font-semibold uppercase tracking-widest text-text-secondary/40 mb-1.5">Data Preview</p>
                            <pre className="text-[10px] text-text-secondary bg-bg-secondary rounded-lg p-2.5 overflow-x-auto max-h-40 leading-relaxed">
                              {JSON.stringify(change.data, null, 2)}
                            </pre>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto" style={{ height: 'calc(100vh - 120px)' }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 py-3 px-1 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center">
          <Navigation2 className="w-4 h-4 text-brand-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-text-primary tracking-tight leading-none">Pilot Seat</h1>
          <p className="text-[11px] text-text-secondary mt-0.5 truncate">
            {project.title || 'No project'} · {characters.length} chars · {plotNodes.length} threads · {chapters.length} chapters
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {committedCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] text-emerald-400 font-semibold">
              <Check className="w-3 h-3" />
              {committedCount} committed
            </div>
          )}

          {stagedChanges.length > 0 && (
            <button
              onClick={commit}
              disabled={committing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary hover:bg-brand-accent disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-xs font-semibold transition-all shadow-[0_4px_15px_rgba(168,85,247,0.3)] active:scale-95"
            >
              {committing ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Committing…</>
              ) : (
                <><Zap className="w-3 h-3" /> Commit {stagedChanges.length}</>
              )}
            </button>
          )}

          <button
            onClick={clearChat}
            title="Clear chat"
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Chat ── */}
      <div
        className="flex-1 overflow-y-auto flex flex-col gap-4 py-3 px-1 min-h-0"
        style={{ scrollBehavior: 'smooth' }}
      >
        {messages.map(renderMessage)}
        <div ref={bottomRef} />
      </div>

      {/* ── Starters ── */}
      {messages.filter(m => m.role === 'user').length === 0 && !sending && (
        <div className="shrink-0 px-1 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {STARTERS.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                className="text-[11px] px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-text-secondary hover:text-text-primary transition-all"
              >
                {s.length > 50 ? s.slice(0, 50) + '…' : s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="shrink-0 pt-2 pb-1 px-1">
        <div className="flex items-end gap-2 bg-bg-secondary border border-white/10 rounded-2xl px-3 py-2.5 focus-within:border-brand-primary/40 transition-all">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            disabled={sending}
            placeholder="Talk to me… ideas, problems, what-ifs, research requests…"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-secondary/40 resize-none focus:outline-none leading-relaxed min-h-[24px]"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || sending}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-brand-primary hover:bg-brand-accent disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all active:scale-90 shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-text-secondary/30 text-center mt-1.5">↵ send · shift+↵ new line · AI will search the web when it needs real facts</p>
      </div>
    </div>
  );
}

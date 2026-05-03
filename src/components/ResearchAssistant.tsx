import React, { useMemo, useState } from 'react';
import { 
  Search, Book, Globe, Sparkles, BrainCircuit, ListTree, 
  ChevronRight, ArrowRight, Microchip, Database, Info, 
  Eye, Headphones, Wind, Hand, Layers, RefreshCcw
} from 'lucide-react';
import { Project, ResearchNote, Chapter } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

interface Props {
  project: Project;
  research: ResearchNote[];
  chapters: Chapter[];
  onAddResearch: (note: ResearchNote) => void;
  onAddChapter: (chapter: Chapter) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const MAX_SCAN_CHARS = 180_000;
const MAX_SYNTHESIS_CHARS = 140_000;
const MAX_NOTE_PREVIEW_CHARS = 1_200;
const MAX_RENDERED_SYNTHESIS_CHARS = 250_000;
const MAX_SELECTED_NOTES = 40;

function boundedChapterText(chapters: Chapter[]): { text: string; wasTrimmed: boolean } {
  let text = '';
  let wasTrimmed = false;
  for (const chapter of chapters) {
    const chunk = `\n\n# ${chapter.title || 'Untitled Chapter'}\n${chapter.summary || ''}\n${chapter.content || ''}`;
    if (text.length + chunk.length > MAX_SCAN_CHARS) {
      text += chunk.slice(0, Math.max(0, MAX_SCAN_CHARS - text.length));
      wasTrimmed = true;
      break;
    }
    text += chunk;
  }
  return { text, wasTrimmed };
}

function buildBoundedResearchPayload(notes: ResearchNote[]): { payload: string; wasTrimmed: boolean } {
  let payload = '';
  let wasTrimmed = false;

  for (const note of notes.slice(0, MAX_SELECTED_NOTES)) {
    const chunk = `\n\nTITLE: ${note.title || 'Untitled'}\nCONTENT: ${(note.content || '').slice(0, 20_000)}\nSENSORY: ${JSON.stringify(note.sensoryDetails || {})}`;
    if (payload.length + chunk.length > MAX_SYNTHESIS_CHARS) {
      payload += chunk.slice(0, Math.max(0, MAX_SYNTHESIS_CHARS - payload.length));
      wasTrimmed = true;
      break;
    }
    payload += chunk;
  }

  if (notes.length > MAX_SELECTED_NOTES) wasTrimmed = true;
  return { payload, wasTrimmed };
}

export default function ResearchAssistant({ project, research, chapters, onAddResearch, onAddChapter, onNotify }: Props) {
  const [activeStep, setActiveStep] = useState<'architecture' | 'exploration' | 'synthesis'>('architecture');
  const [loading, setLoading] = useState(false);
  const [structure, setStructure] = useState<any>(null);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [synthesisResult, setSynthesisResult] = useState<string>('');

  const [pushing, setPushing] = useState(false);
  const [researchingTracks, setResearchingTracks] = useState<string[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);

  const visibleResearch = useMemo(() => (research || []).slice(0, 300), [research]);
  const renderedSynthesis = synthesisResult.length > MAX_RENDERED_SYNTHESIS_CHARS
    ? `${synthesisResult.slice(0, MAX_RENDERED_SYNTHESIS_CHARS)}\n\n---\n\n[Large synthesis truncated in preview to keep the app responsive.]`
    : synthesisResult;

  const scanArtifacts = async () => {
    setLoading(true);
    try {
      onNotify('Scanning manuscript for intelligence gaps...', 'info');
      const { text: fullText, wasTrimmed } = boundedChapterText(chapters);
      if (!fullText.trim()) {
        onNotify('Manuscript is empty. Provide text for intelligence analysis.', 'info');
        return;
      }
      if (wasTrimmed) {
        onNotify('Large manuscript detected. Scanning a safe excerpt to protect the UI.', 'info');
      }
      const needs = await AIService.extractResearchNeeds(fullText, project.type);
      const safeNeeds = (needs || []).slice(0, 50);
      
      if (safeNeeds.length > 0) {
        const newTracks = safeNeeds.map(topic => ({ topic, priority: 'High' }));
        if (structure) {
          const existingTopics = (structure.researchTracks || []).map((t: any) => t.topic);
          const uniqueNewTracks = newTracks.filter(nt => !existingTopics.includes(nt.topic));
          setStructure({
            ...structure,
            researchTracks: [...(structure.researchTracks || []), ...uniqueNewTracks].slice(0, 100)
          });
        } else {
          setStructure({ chapters: [], researchTracks: newTracks });
        }
        onNotify(`Analysis complete: ${safeNeeds.length} knowledge gaps identified.`, 'success');
      } else {
        onNotify('Current knowledge graph satisfies manuscript requirements.', 'success');
      }
    } catch (e) {
      console.error(e);
      onNotify('Failed to index manuscript artifacts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const researchSelectedTracks = async () => {
    if (selectedTracks.length === 0) return;
    const tracksToProcess = [...selectedTracks].slice(0, 12);
    setSelectedTracks([]);
    onNotify(`Starting research on ${tracksToProcess.length} topics...`, 'info');
    for (const topic of tracksToProcess) {
      await handleDeepResearch(topic);
    }
  };

  const generateArchitecture = async () => {
    setLoading(true);
    try {
      const data = await AIService.generateArchitecture(project.title.slice(0, 300), project.genre.slice(0, 120), project.premise.slice(0, 12_000));
      setStructure(data);
      onNotify('Non-fiction architecture generated.', 'success');
    } catch (error) {
      console.error(error);
      onNotify('Failed to map architecture.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeepResearch = async (topic: string) => {
    if (researchingTracks.includes(topic)) return;
    setResearchingTracks(prev => [...prev, topic]);
    try {
      const context = `Non-fiction focus for project ${project.title}. Premise: ${project.premise}`.slice(0, 12_000);
      const note = await AIService.compileResearch(topic.slice(0, 500), context, project.type, true);
      onAddResearch(note);
      onNotify(`Deep research archived: ${topic}`, 'success');
    } catch (error) {
      console.error(error);
      onNotify('Research agent failed.', 'error');
    } finally {
      setResearchingTracks(prev => prev.filter(t => t !== topic));
    }
  };

  const synthesize = async () => {
    if (selectedNotes.length === 0) {
      onNotify('Select research markers first.', 'info');
      return;
    }
    setLoading(true);
    try {
      const notesToUse = research.filter(n => selectedNotes.includes(n.id));
      const { payload, wasTrimmed } = buildBoundedResearchPayload(notesToUse);
      if (wasTrimmed) {
        onNotify('Large research set detected. Synthesising a bounded payload to avoid browser/model failure.', 'info');
      }
      const prompt = `Synthesize the following research notes into a coherent, granular section for a non-fiction book.\n\nFocus on concrete detail, sensory facts, small mechanical or social details, and verified information.\n\nRESEARCH DATA:${payload}\n\nFormat as a professional manuscript section with citations internally.`;
      const result = await AIService.callAI({ prompt, model: "gemini-3.1-pro-preview" });
      setSynthesisResult(result || '');
      setActiveStep('synthesis');
    } catch (error) {
      console.error(error);
      onNotify('Synthesis failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 md:py-12 px-4 md:px-6">
      <header className="mb-8 md:mb-12">
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full w-fit mb-4"><BrainCircuit size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Research Assistant Mode</span></div>
        <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight italic font-serif">Automated Knowledge Synthesis</h1>
        <p className="text-slate-500 max-w-2xl mt-2 font-medium text-sm md:text-base">Build non-fiction structures from deep research clusters. Move from data to truth.</p>
      </header>

      <div className="flex gap-2 md:gap-4 mb-8 p-1 bg-slate-100 rounded-2xl w-full md:w-fit overflow-x-auto no-scrollbar">
        {(['architecture', 'exploration', 'synthesis'] as const).map(step => <button key={step} onClick={() => setActiveStep(step)} className={`px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-1 md:flex-none ${activeStep === step ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{step}</button>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {activeStep === 'architecture' && (
              <motion.div key="arch" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                {!structure ? (
                  <div className="bg-white p-6 md:p-12 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm text-center">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-6"><ListTree size={28} /></div>
                    <h3 className="text-lg md:text-xl font-black text-slate-900 mb-2 italic font-serif">Map the Knowledge Graph</h3>
                    <p className="text-xs md:text-sm text-slate-500 max-w-md mx-auto mb-6 md:mb-8">We'll analyze your premise and generate a research roadmap and structural outline tailored for non-fiction excellence.</p>
                    <button onClick={generateArchitecture} disabled={loading} className="w-full md:w-auto px-8 py-3 md:py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 mx-auto">{loading ? <RefreshCcw className="animate-spin" size={16} /> : <Sparkles size={16} />}Initialize Architecture</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100"><h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><Database size={14} /> Structural Chapters</h4><div className="space-y-4">{structure.chapters?.slice(0, 80).map((ch: any, idx: number) => <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><div className="text-[10px] font-black text-blue-600 mb-1">SECTION {idx + 1}</div><div className="text-sm font-black text-slate-900 italic font-serif mb-1">{ch.title}</div><p className="text-[10px] text-slate-500 leading-relaxed">{ch.focus}</p></div>)}</div></div>
                    <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] flex flex-col h-full"><div className="flex items-center justify-between mb-6"><h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2"><Globe size={14} /> Research Tracks</h4>{structure.researchTracks?.length > 0 && <button onClick={() => setSelectedTracks(selectedTracks.length === structure.researchTracks.length ? [] : structure.researchTracks.slice(0, 50).map((t: any) => t.topic))} className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">{selectedTracks.length === structure.researchTracks.length ? 'Deselect All' : 'Select All'}</button>}</div>
                      <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar pr-1">{structure.researchTracks?.slice(0, 100).map((track: any, idx: number) => { const isResearching = researchingTracks.includes(track.topic); const isSelected = selectedTracks.includes(track.topic); return <button key={idx} onClick={() => { if (isResearching) return; setSelectedTracks(prev => isSelected ? prev.filter(t => t !== track.topic) : [...prev, track.topic]); }} className={`w-full text-left p-4 rounded-2xl border transition-all group relative overflow-hidden ${isSelected ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.1)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}><div className="flex items-center justify-between mb-1"><div className="flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full transition-all ${isSelected ? 'bg-blue-400 scale-150' : 'bg-white/20'}`} /><span className={`text-xs font-bold transition-colors ${isSelected ? 'text-blue-200' : ''}`}>{track.topic}</span></div>{isResearching ? <RefreshCcw size={14} className="animate-spin text-blue-400" /> : <ChevronRight size={14} className={`transition-all ${isSelected ? 'opacity-100 text-blue-400' : 'opacity-0 group-hover:opacity-100'}`} />}</div><span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${track.priority === 'High' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>{isResearching ? 'Processing Search...' : `${track.priority} Priority`}</span>{isResearching && <motion.div layoutId="loading-bar-track" className="absolute bottom-0 left-0 h-1 bg-blue-500" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 15, ease: "linear" }} />}</button>; })}</div>
                      {selectedTracks.length > 0 && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 pt-6 border-t border-white/10"><button onClick={researchSelectedTracks} disabled={loading || researchingTracks.length > 0} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2"><Search size={14} />Deep Research Selected ({Math.min(selectedTracks.length, 12)})</button></motion.div>}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeStep === 'exploration' && (
              <motion.div key="explore" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="bg-white p-8 rounded-[3rem] border border-slate-100 space-y-6">
                <div className="flex items-center justify-between"><h3 className="text-lg font-black italic font-serif text-slate-900">Knowledge Clusters</h3><div className="flex gap-4"><button onClick={() => setSelectedNotes(visibleResearch.slice(0, MAX_SELECTED_NOTES).map(n => n.id))} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">Select Safe Set</button><button onClick={() => setSelectedNotes([])} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors">Clear</button><button onClick={scanArtifacts} disabled={loading} className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:text-blue-700 disabled:opacity-50"><RefreshCcw size={12} className={loading ? 'animate-spin' : ''} /> Analyze Manuscript Gaps</button></div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{visibleResearch.map(note => { const isSelected = selectedNotes.includes(note.id); return <button key={note.id} onClick={() => setSelectedNotes(prev => isSelected ? prev.filter(id => id !== note.id) : [...prev, note.id].slice(0, MAX_SELECTED_NOTES))} className={`p-6 rounded-2xl border text-left transition-all ${isSelected ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500 shadow-xl shadow-blue-500/10' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}><div className="flex items-center gap-2 mb-3"><div className={`w-2 h-2 rounded-full ${note.isDeepResearch ? 'bg-blue-500' : 'bg-slate-300'} ${isSelected ? 'scale-125' : ''}`} /><h4 className="text-sm font-black text-slate-900 truncate flex-1">{note.title}</h4>{isSelected && <Sparkles size={12} className="text-blue-600 animate-pulse" />}</div><p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed mb-4 font-medium">{(note.content || '').slice(0, MAX_NOTE_PREVIEW_CHARS)}</p>{note.sensoryDetails && <div className="flex gap-2 opacity-60">{note.sensoryDetails.visuals && <Eye size={12} />}{note.sensoryDetails.sounds && <Headphones size={12} />}{note.sensoryDetails.smells && <Wind size={12} />}{note.sensoryDetails.textures && <Hand size={12} />}</div>}</button>; })}</div>
                <div className="pt-6 border-t border-slate-50 flex justify-end"><button onClick={synthesize} disabled={loading || selectedNotes.length === 0} className="px-8 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50">Synthesize Selected ({selectedNotes.length}) <ArrowRight size={14} /></button></div>
              </motion.div>
            )}

            {activeStep === 'synthesis' && (
              <motion.div key="synth" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6"><div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm min-h-[400px]"><header className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50"><h3 className="text-xl font-black italic font-serif text-slate-900">Synthesized Knowledge Draft</h3><div className="flex gap-2"><button onClick={async () => { if (pushing || !synthesisResult) return; setPushing(true); try { const chapId = crypto.randomUUID(); await onAddChapter({ id: chapId, title: 'Proposed Synthesis', content: synthesisResult, summary: 'Synthesized from deep research.', order: chapters.length + 1, plotNodeIds: [], tags: ['synthesis'], updatedAt: Date.now() }); onNotify('Synthesis added to Manuscript Writing Studio.', 'success'); } catch (e) { console.error(e); onNotify('Failed to add synthesis to manuscript.', 'error'); } finally { setPushing(false); } }} disabled={pushing || !synthesisResult} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-2 disabled:opacity-50">{pushing ? <RefreshCcw className="animate-spin" size={12} /> : null}Push to Manuscript</button><button onClick={() => setSynthesisResult('')} className="p-2 text-slate-400 hover:text-slate-600"><RefreshCcw size={16} /></button></div></header><div className="prose prose-slate max-w-none prose-p:leading-loose prose-headings:font-serif"><Markdown>{renderedSynthesis || 'No synthesis generated yet. Select notes in "Exploration" tab.'}</Markdown></div></div></motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-4 space-y-6"><div className="bg-blue-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden"><div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><Microchip size={120} /></div><h4 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">Prose Intelligence</h4><p className="text-xs font-medium leading-relaxed mb-6">Non-fiction succeeds on <b>granularity</b>. Use the Deep Search tool to find exact specifications, historical dates, and sensory artifacts that build authority.</p><div className="space-y-4"><div className="flex items-start gap-3"><div className="p-2 bg-blue-800 rounded-xl"><Layers size={14} /></div><div><p className="text-[10px] font-black uppercase tracking-tight text-blue-200">Layered Research</p><p className="text-[9px] text-blue-300 font-medium">Combine technical data with eyewitness accounts.</p></div></div><div className="flex items-start gap-3"><div className="p-2 bg-blue-800 rounded-xl"><Info size={14} /></div><div><p className="text-[10px] font-black uppercase tracking-tight text-blue-200">Verification Logic</p><p className="text-[9px] text-blue-300 font-medium">Auto-crosscheck against verified Google Search indices.</p></div></div></div></div><div className="p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem]"><h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Knowledge Pulse</h4><div className="space-y-2"><div className="flex items-center justify-between p-3 bg-white rounded-xl text-[9px] font-bold"><span className="text-slate-500">Research Notes</span><span className="text-slate-900">{research.length}</span></div><div className="flex items-center justify-between p-3 bg-white rounded-xl text-[9px] font-bold"><span className="text-slate-500">Deep Searches</span><span className="text-slate-900">{research.filter(r => r.isDeepResearch).length}</span></div><div className="flex items-center justify-between p-3 bg-white rounded-xl text-[9px] font-bold"><span className="text-slate-500">Visible Notes</span><span className="text-slate-900">{visibleResearch.length}</span></div></div></div></div>
      </div>
    </div>
  );
}

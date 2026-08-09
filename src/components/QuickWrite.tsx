/**
 * Just Write — guided path from idea to finished book.
 * The simple path always exposes one obvious next action; advanced controls remain available.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Loader,
  Sparkles,
  Wand2,
  Scissors,
  Download,
  PenLine,
  RotateCcw,
  Search,
  BookOpenCheck,
  CirclePlus,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { BUILTIN_AWARD_LENSES, type AwardLens } from '../services/literary/awardsShelf';
import {
  loadPlotHold,
  plotHoldFromProposal,
  nextPendingBeat,
  markBeatDrafted,
  plotHoldSummary,
  savePlotHold,
  type PlotHold,
} from '../services/plotHoldService';
import {
  countWords,
  defaultTargetWordCount,
  planQualityCut,
  type CutPlan,
} from '../services/wordCountService';
import { formatShowPackForWriting, hasShowBoxContent } from '../services/showBoxService';
import {
  AI_FETCH_TIMEOUT_MS,
  AI_LONG_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
  friendlyFetchError,
} from '../lib/fetchWithTimeout';
import { readApiJson } from '../services/apiJson';
import {
  addNote,
  deepResearchTopic,
  getProjectKey,
  loadLibrary,
  suggestResearchTopics,
} from '../services/researchLibraryService';

type StepId = 'seed' | 'spine' | 'draft' | 'finish' | 'cut' | 'pack';
const WHOLE_BOOK_JOB_KEY = 'caspa.wholeBookJobId';

type FinishRecommendation = { id: string; title: string; detail: string; severity: 'critical' | 'major' | 'minor' };
type BrokenPromise = { id: string; statement: string; fix: string };
type FinishDiagnosis = {
  verdict: string;
  recommendations: FinishRecommendation[];
  brokenPromises: BrokenPromise[];
  researchTopics: string[];
};
type DraftSection = { heading: string; body: string };

type Props = {
  brief: { title: string; mode: string; idea: string; tone: string; output: string; targetWordCount?: number };
  draftPage: string;
  onDraftChange: (text: string) => void;
  onTargetWordCountChange?: (n: number) => void;
  onGoPublish: () => void;
  onGoWorkshop: () => void;
  onGoShowBox?: () => void;
};

function writeModeForBrief(mode: string): string {
  if (mode === 'gold') return 'polish';
  if (mode === 'picture') return 'novel';
  if (['nonfiction', 'essay', 'poetry', 'script', 'musical', 'adaptation', 'chaos', 'novel'].includes(mode)) return mode;
  return 'novel';
}
function isNonfictionMode(mode: string) { return mode === 'nonfiction' || mode === 'essay'; }
function stepsForMode(mode: string) {
  const nonfiction = isNonfictionMode(mode);
  return [
    { id: 'seed' as const, label: 'Idea', detail: nonfiction ? 'Question, thesis and reader need' : 'Wound, desire and pressure' },
    { id: 'spine' as const, label: 'Structure', detail: nonfiction ? 'Claims and section turns' : 'Plot and chapter turns' },
    { id: 'draft' as const, label: 'Draft', detail: 'Write the held manuscript' },
    { id: 'finish' as const, label: 'Finish', detail: 'Close gaps, promises, research and length' },
    { id: 'cut' as const, label: 'Polish', detail: 'Cut only what weakens the work' },
    { id: 'pack' as const, label: 'Ready', detail: 'Final gate and export' },
  ];
}
function sectionHeading(title: string, index: number, mode: string) {
  const kind = isNonfictionMode(mode) ? 'Section' : mode === 'script' || mode === 'musical' ? 'Scene' : 'Chapter';
  return `\n\n# ${title.trim() || `${kind} ${index + 1}`}\n\n`;
}
function parseJsonLoose(text: string): any {
  try { return JSON.parse(text); } catch {}
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) return JSON.parse(fenced[1]);
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  } catch {}
  return {};
}
function splitDraftSections(text: string): DraftSection[] {
  const source = text.trim();
  if (!source) return [];
  const lines = source.split('\n');
  const sections: DraftSection[] = [];
  let heading = '';
  let body: string[] = [];
  const flush = () => {
    const content = body.join('\n').trim();
    if (content || heading) sections.push({ heading: heading.trim(), body: content });
    body = [];
  };
  for (const line of lines) {
    if (/^#\s+\S/.test(line)) { flush(); heading = line.replace(/^#\s+/, '').trim(); }
    else body.push(line);
  }
  flush();
  if (sections.length === 1 && !sections[0].heading) sections[0].heading = 'Manuscript';
  return sections;
}
function joinDraftSections(sections: DraftSection[]): string {
  return sections.map((s) => `${s.heading ? `# ${s.heading}\n\n` : ''}${s.body.trim()}`.trim()).filter(Boolean).join('\n\n');
}

export default function QuickWrite({ brief, draftPage, onDraftChange, onTargetWordCountChange, onGoPublish, onGoWorkshop, onGoShowBox }: Props) {
  const mode = writeModeForBrief(brief.mode);
  const nonfiction = isNonfictionMode(mode);
  const showPackLive = hasShowBoxContent();
  const STEPS = useMemo(() => stepsForMode(mode), [mode]);
  const [step, setStep] = useState<StepId>('seed');
  const [seed, setSeed] = useState(brief.idea || '');
  const [lenses, setLenses] = useState<AwardLens[]>(BUILTIN_AWARD_LENSES);
  const [prizeLensId, setPrizeLensId] = useState(mode === 'essay' ? 'essay-orwell' : nonfiction ? 'pulitzer-nonfiction' : 'booker-literary');
  const [proposal, setProposal] = useState<any>(null);
  const [critic, setCritic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [bookProgress, setBookProgress] = useState<{ done: number; total: number; title: string } | null>(null);
  const [plotHold, setPlotHold] = useState<PlotHold | null>(() => loadPlotHold());
  const [cutPlan, setCutPlan] = useState<CutPlan | null>(null);
  const [wholeBookJobId, setWholeBookJobId] = useState<string>(() => { try { return localStorage.getItem(WHOLE_BOOK_JOB_KEY) || ''; } catch { return ''; } });
  const [finishDiagnosis, setFinishDiagnosis] = useState<FinishDiagnosis | null>(null);
  const [selectedFixes, setSelectedFixes] = useState<string[]>([]);
  const [selectedPromises, setSelectedPromises] = useState<string[]>([]);
  const [researchTopics, setResearchTopics] = useState<string[]>([]);
  const [addedResearch, setAddedResearch] = useState<string[]>([]);
  const [researchBusy, setResearchBusy] = useState('');
  const [finishDone, setFinishDone] = useState(false);

  const targetWords = typeof brief.targetWordCount === 'number' && brief.targetWordCount > 0 ? brief.targetWordCount : defaultTargetWordCount(brief.mode);
  const currentWords = useMemo(() => countWords(draftPage), [draftPage]);
  const shortfall = Math.max(0, targetWords - currentWords);
  const wordRangeOk = currentWords >= targetWords * .95 && currentWords <= targetWords * 1.05;
  const qualityOk = qualityScore != null && qualityScore >= 80;
  const wholeBookRunning = Boolean(wholeBookJobId);
  const projectBrief = useMemo(() => ({ ...brief, audience: 'General reader', targetWordCount: targetWords }), [brief, targetWords]);
  const projectKey = useMemo(() => getProjectKey(projectBrief), [projectBrief]);
  const openPromiseCount = finishDiagnosis?.brokenPromises.filter((p) => selectedPromises.includes(p.id)).length || 0;
  const selectedFixCount = finishDiagnosis?.recommendations.filter((r) => selectedFixes.includes(r.id)).length || 0;

  const stageHealth = useMemo(() => {
    const structure = plotHold?.beats?.length ? `${plotHold.beats.filter((b) => b.status === 'drafted').length}/${plotHold.beats.length}` : '—';
    return { structure, words: `${Math.round((currentWords / Math.max(1, targetWords)) * 100)}%`, quality: qualityScore == null ? 'Not checked' : `${qualityScore}/100` };
  }, [plotHold, currentWords, targetWords, qualityScore]);

  const recommendedStep: StepId = !plotHold?.beats?.length ? (proposal ? 'spine' : 'seed') : !draftPage.trim() ? 'draft' : !finishDone || !wordRangeOk ? 'finish' : !qualityOk ? 'cut' : 'pack';

  useEffect(() => {
    fetch('/api/caspa/write/awards').then((r) => readApiJson<any>(r)).then((j) => {
      if (!j?.data?.lenses?.length) return;
      setLenses(j.data.lenses);
      const ids = j.data.lenses.map((l: AwardLens) => l.id) as string[];
      if (mode === 'essay' && ids.includes('essay-orwell')) setPrizeLensId((p) => p === 'booker-literary' ? 'essay-orwell' : p);
      else if (nonfiction && ids.includes('pulitzer-nonfiction')) setPrizeLensId((p) => p === 'booker-literary' ? 'pulitzer-nonfiction' : p);
    }).catch(() => {});
  }, [mode, nonfiction]);

  useEffect(() => {
    if (!draftPage.trim()) setCutPlan(null);
    else setCutPlan(planQualityCut(draftPage, { mode, targetWordCount: targetWords }));
  }, [draftPage, mode, targetWords]);

  useEffect(() => {
    if (!wholeBookJobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clearJob = () => { try { localStorage.removeItem(WHOLE_BOOK_JOB_KEY); } catch {} if (!cancelled) setWholeBookJobId(''); };
    const poll = async () => {
      try {
        const response = await fetch(`/api/caspa/write/whole-book/job/${encodeURIComponent(wholeBookJobId)}`, { cache: 'no-store' });
        const json = await readApiJson<any>(response);
        if (!response.ok || !json.success) throw new Error(json.message || 'Could not read whole-book job.');
        const job = json.data;
        const result = job?.result || {};
        const done = Number(result.done || 0), total = Math.max(1, Number(result.total || 1));
        const title = String(result.currentTitle || job.stage || 'Working');
        if (typeof result.manuscript === 'string' && result.manuscript) onDraftChange(result.manuscript);
        if (result.plotHold?.beats) { const held = savePlotHold(result.plotHold as PlotHold); setPlotHold(held); }
        setBookProgress({ done, total, title });
        setStatus(`Writing ${done}/${total} · ${Number(result.words || 0).toLocaleString()} / ${targetWords.toLocaleString()} words · ${title}`);
        if (job.status === 'complete') {
          const finalText = String(result.finalText || result.manuscript || '');
          if (finalText) onDraftChange(finalText);
          if (result.score != null) setQualityScore(Number(result.score));
          setBookProgress({ done: total, total, title: 'Complete' });
          setFinishDiagnosis(null); setFinishDone(false); setStep('finish'); setBusy(false); clearJob();
          setStatus('Draft complete. Caspa has moved you to Finish automatically. Analyse the last mile, then apply the accepted repairs.');
          return;
        }
        if (job.status === 'failed') {
          setStep('draft'); setBusy(false); setError(`${job.error || 'Whole-book job failed'} — completed material has been kept.`); clearJob(); return;
        }
      } catch { setStatus('Background draft is still registered. Reconnecting…'); }
      if (!cancelled) timer = setTimeout(poll, 2000);
    };
    setBusy(true); setStep('draft'); void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [wholeBookJobId, onDraftChange, targetWords]);

  const sharedWriteBody = (hold: PlotHold | null, focus?: { title: string; turn: string } | null) => {
    const basePremise = proposal?.premise || hold?.premise || seed || brief.idea;
    const showPack = mode === 'musical' || mode === 'script' ? formatShowPackForWriting() : '';
    return {
      mode,
      genre: proposal?.genre || hold?.genre || (nonfiction ? 'Serious Non-Fiction' : mode === 'musical' ? 'Musical / Show' : mode === 'script' ? 'Stage Play' : 'Literary fiction'),
      premise: showPack ? `${basePremise}\n\n${showPack}` : basePremise,
      tone: proposal?.tone || hold?.tone || brief.tone,
      prizeLensId,
      plotHold: hold || undefined,
      focusBeat: focus ? `${focus.title}: ${focus.turn}` : undefined,
      targetWordCount: targetWords,
      output: brief.output,
    };
  };

  const runSeed = async () => {
    setBusy(true); setError(''); setStatus(nonfiction ? 'Building an evidence-led structure…' : 'Building a prize-ambition story spine…');
    try {
      const res = await fetchWithTimeout('/api/caspa/write/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seed, mode }) }, AI_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.success) throw new Error(json.message || 'Seed failed');
      setProposal(json.data); const held = plotHoldFromProposal(json.data || {}, brief.title); setPlotHold(held);
      if (json.data?.premise) setSeed(json.data.premise);
      setStep('spine'); setStatus('Structure built. Check it once, then accept it to lock the book before prose begins.');
    } catch (err) { setError(friendlyFetchError(err, 'Could not build the structure')); }
    finally { setBusy(false); }
  };

  const runPrizeDraft = async () => {
    setBusy(true); setError('');
    try {
      const hold = plotHold || loadPlotHold(); const focus = nextPendingBeat(hold);
      const res = await fetchWithTimeout('/api/caspa/write/prize-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sharedWriteBody(hold, focus), output: nonfiction ? 'Full opening section for the current focus beat' : 'Full opening chapter for the current focus beat', sourceText: draftPage }) }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res); if (!res.ok || !json.success) throw new Error(json.message || 'Draft failed');
      const text = json.data.text || ''; onDraftChange(text); if (hold && focus) setPlotHold(markBeatDrafted(focus.id));
      setCritic(json.data.criticReport || ''); setQualityScore(json.data.quality?.overallScore ?? null); setStep('draft');
    } catch (err) { setError(friendlyFetchError(err, 'Draft failed')); } finally { setBusy(false); }
  };

  const runContinue = async () => {
    setBusy(true); setError('');
    try {
      const hold = plotHold || loadPlotHold(); const focus = nextPendingBeat(hold);
      const res = await fetchWithTimeout('/api/caspa/write/continue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sharedWriteBody(hold, focus), sourceText: draftPage, wholeBook: false }) }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res); if (!res.ok || !json.success) throw new Error(json.message || 'Continue failed');
      const next = json.data.text || ''; const heading = sectionHeading(json.data.beatTitle || focus?.title || '', (hold?.beats || []).findIndex((b) => b.title === focus?.title), mode);
      onDraftChange(`${draftPage.trim()}${heading}${next}`.trim()); if (hold && focus) setPlotHold(markBeatDrafted(focus.id));
    } catch (err) { setError(friendlyFetchError(err, 'Continue failed')); } finally { setBusy(false); }
  };

  const runWholeBook = async () => {
    setError(''); const hold = plotHold || loadPlotHold();
    if (!hold?.beats?.length) { setStep('seed'); setError('Build and lock the structure first.'); return; }
    setBusy(true); setStep('draft'); setStatus('Starting the background book job…');
    try {
      const res = await fetch('/api/caspa/write/whole-book/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sharedWriteBody(hold, null), sourceText: draftPage, wholeBook: true }) });
      const json = await readApiJson<any>(res); if (!res.ok || !json.success || !json.jobId) throw new Error(json.message || 'Could not start whole-book job');
      try { localStorage.setItem(WHOLE_BOOK_JOB_KEY, json.jobId); } catch {}
      setWholeBookJobId(json.jobId); const pending = hold.beats.filter((b) => b.status !== 'drafted'); setBookProgress({ done: 0, total: pending.length || hold.beats.length, title: 'Queued' });
      setStatus('Writing in the background. You can leave this page; Caspa will reconnect automatically.');
    } catch (err) { setBusy(false); setError(friendlyFetchError(err, 'Whole-book job could not start')); }
  };

  const forgetStaleJob = () => { try { localStorage.removeItem(WHOLE_BOOK_JOB_KEY); } catch {} setWholeBookJobId(''); setBusy(false); setBookProgress(null); setStatus('Background-job link cleared. Existing draft kept.'); };

  const analyseFinish = async () => {
    if (!draftPage.trim()) { setError('There is no manuscript to finish yet.'); return; }
    setBusy(true); setError(''); setFinishDone(false); setStatus('Checking structure, threads, promises, evidence, AI nonsense and missing substance…');
    try {
      const prompt = `You are Caspa's final commissioning editor. Diagnose this manuscript for FINISHING, not for starting over.\n\nTITLE: ${brief.title}\nMODE: ${mode}\nPREMISE: ${brief.idea}\nTARGET LENGTH: ${targetWords}\nCURRENT LENGTH: ${currentWords}\nSHORTFALL: ${shortfall}\n\nLOCKED STRUCTURE:\n${plotHold ? plotHoldSummary(plotHold) : 'No summary available'}\n\nMANUSCRIPT:\n${draftPage.slice(0, 110000)}\n\nReturn JSON only: {"verdict":"...","recommendations":[{"id":"rec-1","title":"...","detail":"specific fix","severity":"critical|major|minor"}],"brokenPromises":[{"id":"promise-1","statement":"...","fix":"..."}],"researchTopics":["..."]}.\n\nRules: structure before prose; detect abandoned threads, contradictions, repetition, AI fog, unsupported claims and invented authority. If materially under target, prescribe substantive expansion, never padding. For non-fiction prioritise evidence, counterargument, examples, definitions, practical usefulness and sourceable claims. Give 3-7 recommendations.`;
      const res = await fetchWithTimeout('/api/ai/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, json: true, maxTokens: 5200 }) }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res); if (!res.ok || !json.result) throw new Error(json.message || 'Finish analysis failed');
      const parsed = parseJsonLoose(String(json.result));
      const recs: FinishRecommendation[] = Array.isArray(parsed.recommendations) ? parsed.recommendations.map((r: any, i: number) => ({ id: String(r.id || `rec-${i + 1}`), title: String(r.title || 'Improve manuscript'), detail: String(r.detail || ''), severity: ['critical','major','minor'].includes(r.severity) ? r.severity : 'major' })) : [];
      if (shortfall > targetWords * .03 && !recs.some((r) => /word|length|expand|short/i.test(`${r.title} ${r.detail}`))) recs.unshift({ id: 'rec-hit-target', title: `Earn the missing ${shortfall.toLocaleString()} words`, detail: nonfiction ? 'Deepen evidence, examples, counterargument, practical detail and source-aware caveats. No padding.' : 'Deepen causal scenes, character pressure and promised payoffs. No padding.', severity: 'critical' });
      const promises: BrokenPromise[] = Array.isArray(parsed.brokenPromises) ? parsed.brokenPromises.map((p: any, i: number) => ({ id: String(p.id || `promise-${i + 1}`), statement: String(p.statement || ''), fix: String(p.fix || '') })).filter((p: BrokenPromise) => p.statement) : [];
      let topics: string[] = Array.isArray(parsed.researchTopics) ? parsed.researchTopics.map(String).filter(Boolean) : [];
      try { topics = [...new Set([...topics, ...(await suggestResearchTopics(projectBrief as any, draftPage.slice(0, 18000)))])].slice(0, 8); } catch {}
      const diagnosis = { verdict: String(parsed.verdict || 'Finish analysis complete.'), recommendations: recs, brokenPromises: promises, researchTopics: topics };
      setFinishDiagnosis(diagnosis); setSelectedFixes(recs.map((r) => r.id)); setSelectedPromises(promises.map((p) => p.id)); setResearchTopics(topics);
      setStatus('Finish plan ready. Sensible repairs are selected by default. Add research if useful, then run the finish pass.');
    } catch (err) { setError(friendlyFetchError(err, 'Could not analyse the finish')); } finally { setBusy(false); }
  };

  const addResearchTopic = async (topic: string) => {
    if (!topic || addedResearch.includes(topic)) return;
    setResearchBusy(topic); setError('');
    try { const note = await deepResearchTopic(topic, projectBrief as any, draftPage.slice(0, 15000)); addNote(projectKey, note); setAddedResearch((prev) => [...prev, topic]); }
    catch (err) { setError(friendlyFetchError(err, 'Research failed')); } finally { setResearchBusy(''); }
  };
  const addAllResearch = async () => { for (const topic of researchTopics) if (!addedResearch.includes(topic)) await addResearchTopic(topic); };

  const finishBookToTarget = async () => {
    if (!finishDiagnosis) { await analyseFinish(); return; }
    const sections = splitDraftSections(draftPage); if (!sections.length) { setError('Could not find manuscript sections to finish.'); return; }
    setBusy(true); setError(''); setFinishDone(false);
    const fixes = finishDiagnosis.recommendations.filter((r) => selectedFixes.includes(r.id));
    const promises = finishDiagnosis.brokenPromises.filter((p) => selectedPromises.includes(p.id));
    const notes = loadLibrary(projectKey).slice(-10);
    const researchBlock = notes.length ? notes.map((n) => `RESEARCH: ${n.title}\n${String(n.content || '').slice(0, 3500)}\nSOURCES: ${(n.sources || []).join('; ')}`).join('\n\n') : 'No additional research notes supplied.';
    const originalWords = sections.map((s) => countWords(s.body)); const gap = Math.max(0, targetWords - originalWords.reduce((a, b) => a + b, 0));
    let working = sections.map((s) => ({ ...s }));
    try {
      for (let i = 0; i < working.length; i++) {
        const original = originalWords[i]; const extra = gap > 0 ? Math.ceil(gap / working.length) : 0; const target = Math.max(original, original + extra); const section = working[i];
        setStatus(`Finishing ${section.heading || `section ${i + 1}`} · ${i + 1}/${working.length} · target ~${target.toLocaleString()} words`);
        const prompt = `You are Caspa's finishing editor. Return the COMPLETE revised section only.\n\nBOOK: ${brief.title}\nMODE: ${mode}\nSECTION: ${section.heading || i + 1}\nCURRENT SECTION WORDS: ${original}\nTARGET FOR THIS PASS: ~${target}\nBOOK TARGET: ${targetWords}\n\nAPPROVED FIXES:\n${fixes.length ? fixes.map((r) => `- ${r.title}: ${r.detail}`).join('\n') : '- Preserve what works.'}\n\nOPEN PROMISES:\n${promises.length ? promises.map((p) => `- ${p.statement} -> ${p.fix}`).join('\n') : '- None selected.'}\n\nRESEARCH:\n${researchBlock}\n\nEXISTING SECTION:\n${section.body.slice(0, 70000)}\n\nRULES: structure and continuity before style; preserve established facts and voice; never invent quotations, citations, people, dates or authorities; integrate only relevant verified research; pay off promises where genuinely due; expansion must earn its words with evidence/argument/examples or scene/causality/payoff; no repetition, generic AI fog or fake profundity; never make an under-target manuscript shorter. Return only the complete replacement section.`;
        const res = await fetchWithTimeout('/api/ai/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, maxTokens: Math.min(28000, Math.max(6000, Math.round(target * 1.7))) }) }, AI_LONG_FETCH_TIMEOUT_MS);
        const json = await readApiJson<any>(res); if (!res.ok || !json.result) throw new Error(json.message || `Finish failed on ${section.heading || i + 1}`);
        const revised = String(json.result).trim(); if (revised) working[i].body = revised; onDraftChange(joinDraftSections(working));
      }
      const finalText = joinDraftSections(working); const finalWords = countWords(finalText); onDraftChange(finalText); setFinishDone(true);
      setStatus(finalWords < targetWords * .95 ? `Finish pass complete at ${finalWords.toLocaleString()} words. Still short; run one more finish pass.` : `Finish pass complete at ${finalWords.toLocaleString()} words. Next: final quality gate.`);
    } catch (err) { setError(`${friendlyFetchError(err, 'Finish pass failed')} — completed sections have been kept.`); } finally { setBusy(false); }
  };

  const runCut = async () => {
    if (!draftPage.trim()) return;
    if (currentWords < targetWords * .95) { setStep('finish'); setError(`Still ${shortfall.toLocaleString()} words short. Finish before polishing.`); return; }
    setBusy(true); setError(''); const plan = planQualityCut(draftPage, { mode, targetWordCount: targetWords }); setCutPlan(plan);
    try {
      const res = await fetchWithTimeout('/api/caspa/write/cut', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: draftPage, mode, targetWordCount: targetWords }) }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res); if (!res.ok || !json.success) throw new Error(json.message || 'Polish failed'); onDraftChange(json.data.text || '');
      setQualityScore(null); setStep('cut'); setStatus('Polish complete. Run the final quality gate before export.');
    } catch (err) { setError(friendlyFetchError(err, 'Polish failed')); } finally { setBusy(false); }
  };

  const runPrizePass = async () => {
    if (!draftPage.trim()) return;
    setBusy(true); setError(''); setStatus(nonfiction ? 'Running final editorial gate…' : 'Running prize-readiness gate…');
    try {
      const res = await fetchWithTimeout('/api/caspa/write/prize-pass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: draftPage, prizeLensId, title: brief.title, mode, targetWordCount: targetWords }) }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res); if (!res.ok || !json.success) throw new Error(json.message || 'Quality gate failed');
      const score = Number(json.data.assessment?.overallReadiness || json.data.quality?.overallScore || 0); setQualityScore(score);
      setCritic([json.data.assessment?.judgeComment, ...(json.data.assessment?.fixes || []).map((f: string, i: number) => `${i + 1}. ${f}`)].filter(Boolean).join('\n'));
      if (json.data.readyEnough && wordRangeOk) { setStep('pack'); setStatus('Final gate passed. The manuscript is in range and ready to pack.'); }
      else { setStep('finish'); setFinishDone(false); setStatus('Final gate found work to do. Caspa has returned you to Finish; re-analyse and repair only the remaining issues.'); }
    } catch (err) { setError(friendlyFetchError(err, 'Final quality gate failed')); } finally { setBusy(false); }
  };

  const guidedAction = () => {
    if (recommendedStep === 'seed') return { label: 'Build the book structure', action: runSeed, disabled: busy || !seed.trim() };
    if (recommendedStep === 'spine') return { label: 'Lock structure and write the book', action: () => { setStep('draft'); void runWholeBook(); }, disabled: busy || !plotHold?.beats?.length };
    if (recommendedStep === 'draft') return { label: 'Write the whole book', action: runWholeBook, disabled: busy || wholeBookRunning };
    if (recommendedStep === 'finish') return finishDiagnosis
      ? { label: wordRangeOk && finishDone ? 'Run final quality gate' : 'Apply finish plan', action: wordRangeOk && finishDone ? runPrizePass : finishBookToTarget, disabled: busy || Boolean(researchBusy) }
      : { label: 'Analyse and finish the manuscript', action: analyseFinish, disabled: busy || !draftPage.trim() };
    if (recommendedStep === 'cut') return { label: 'Run final quality gate', action: runPrizePass, disabled: busy || !draftPage.trim() };
    return { label: 'Publish / export', action: onGoPublish, disabled: false };
  };
  const next = guidedAction();

  return (
    <div style={{ display: 'grid', gap: 18, color: '#f4f1e9' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 28, letterSpacing: -.6, color: '#182033' }}>Just write</h2>
        <p style={{ margin: '8px 0 0', color: '#64708a', maxWidth: 820 }}>You do not need to know Caspa's tools. Follow the highlighted next action: structure → draft → finish → final gate → export. Structure and promises outrank prose; target length must be earned, not padded.</p>
      </div>

      <section style={{ ...darkCard, padding: 16, borderColor: '#596fae' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ color: '#8ea7ff', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, fontWeight: 800 }}>Next best action</div>
            <div style={{ marginTop: 4, fontSize: 18, fontWeight: 750 }}>{next.label}</div>
            <div style={{ marginTop: 4, color: '#aeb7ca', fontSize: 13 }}>{recommendedStep === 'finish' ? `${shortfall ? `${shortfall.toLocaleString()} words still to earn · ` : ''}${selectedFixCount} accepted repairs · ${openPromiseCount} open promises` : STEPS.find((s) => s.id === recommendedStep)?.detail}</div>
          </div>
          <button type="button" disabled={next.disabled} onClick={next.action} style={button('#8ea7ff', '#0d111b')}>{busy ? <Loader size={16} className="spin" /> : <ArrowRight size={16} />} {next.label}</button>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
        <Metric label="Structure" value={stageHealth.structure} />
        <Metric label="Words" value={`${currentWords.toLocaleString()} · ${stageHealth.words}`} danger={draftPage.trim().length > 0 && !wordRangeOk} />
        <Metric label="Quality" value={stageHealth.quality} danger={qualityScore != null && !qualityOk} />
        <Metric label="Promises" value={finishDiagnosis ? String(finishDiagnosis.brokenPromises.length) : 'Checked at Finish'} danger={Boolean(finishDiagnosis?.brokenPromises.length)} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STEPS.map((s) => {
          const active = s.id === step; const rec = s.id === recommendedStep;
          return <button key={s.id} type="button" onClick={() => setStep(s.id)} title={s.detail} style={{ border: active || rec ? '2px solid #8ea7ff' : '1px solid #c7cfdf', background: active ? '#e8ecff' : '#fff', color: '#182033', borderRadius: 999, padding: '8px 13px', cursor: 'pointer', display: 'flex', gap: 7, alignItems: 'center', fontWeight: active ? 750 : 550 }}>{rec && !active ? <ArrowRight size={13} /> : null}{s.label}</button>;
        })}
      </div>

      {plotHold && <div style={{ fontSize: 13, color: '#64708a' }}>Locked structure: {plotHoldSummary(plotHold)}</div>}

      <details style={{ ...darkCard, padding: 14 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Book settings</summary>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14 }}>
          <label style={{ display: 'grid', gap: 6, maxWidth: 420, flex: '1 1 240px' }}><span style={labelStyle}>{nonfiction ? 'Quality lens' : 'Prize lens'}</span><select value={prizeLensId} onChange={(e) => setPrizeLensId(e.target.value)} style={lightInput}>{lenses.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 6, maxWidth: 220, flex: '0 1 180px' }}><span style={labelStyle}>Target words</span><input type="number" min={100} step={500} value={targetWords} onChange={(e) => onTargetWordCountChange?.(Math.max(100, Number(e.target.value) || 100))} disabled={!onTargetWordCountChange} style={{ ...lightInput, fontWeight: 650 }} /></label>
        </div>
      </details>

      {(mode === 'musical' || showPackLive) && <div style={{ ...darkCard, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><span style={darkMuted}>{showPackLive ? 'Show in a Box is active.' : 'Build the show pack before scene drafting.'}</span>{onGoShowBox && <button type="button" onClick={onGoShowBox} style={button('#20283a', '#f4f1e9')}>Open Show in a Box</button>}</div>}

      {step === 'seed' && <section style={darkCard}><h3 style={darkH3}>1. Give Caspa the idea</h3><p style={darkMuted}>{nonfiction ? 'State the question, problem, thesis or reader need. Caspa will turn it into an evidence-led structure before prose begins.' : 'State the premise, pressure or image. Caspa will lock a structure before prose begins.'}</p><textarea value={seed} onChange={(e) => setSeed(e.target.value)} rows={6} style={darkTextarea} /><button type="button" disabled={busy || !seed.trim()} onClick={runSeed} style={button('#8ea7ff', '#0d111b')}>{busy ? <Loader size={16} className="spin" /> : <Sparkles size={16} />} Build structure</button></section>}

      {step === 'spine' && <section style={darkCard}><h3 style={darkH3}>2. Lock the structure</h3><p style={darkMuted}>This is the contract Caspa must keep. Check the turns once; prose comes afterwards.</p>{proposal ? <div style={{ display: 'grid', gap: 12 }}><strong>{proposal.title || brief.title}</strong><p style={{ margin: 0 }}>{proposal.premise}</p><ul style={{ margin: 0, paddingLeft: 18 }}>{(proposal.chapters || proposal.scenePlan || []).slice(0, 16).map((ch: any, i: number) => <li key={i} style={{ marginBottom: 6 }}>{typeof ch === 'string' ? ch : `${ch.title || `Beat ${i + 1}`}: ${ch.turn || ch.endingImage || ''}`}</li>)}</ul><button type="button" disabled={busy} onClick={() => { setStep('draft'); void runWholeBook(); }} style={button('#8ea7ff', '#0d111b')}><Wand2 size={16} /> Accept structure & write whole book</button></div> : <p style={darkMuted}>No structure yet. Return to Idea and build one.</p>}</section>}

      {step === 'draft' && <section style={darkCard}><h3 style={darkH3}>3. Draft</h3><p style={darkMuted}>Whole-book work runs in the background and resumes after reloads. Caspa writes against the locked structure, not by improvising a new book halfway through.</p>{bookProgress && <><div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd3e7' }}><span>{bookProgress.done}/{bookProgress.total} · <strong>{bookProgress.title}</strong></span><span>{Math.round(bookProgress.done / Math.max(1, bookProgress.total) * 100)}%</span></div><div style={{ margin: '8px 0 14px', height: 9, borderRadius: 99, background: '#293249', overflow: 'hidden' }}><div style={{ width: `${Math.round(bookProgress.done / Math.max(1, bookProgress.total) * 100)}%`, height: '100%', background: '#8ea7ff' }} /></div></>}<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button type="button" disabled={wholeBookRunning || busy} onClick={runWholeBook} style={button('#8ea7ff', '#0d111b')}>{wholeBookRunning ? <Loader size={16} className="spin" /> : <Wand2 size={16} />} {wholeBookRunning ? 'Writing…' : 'Write whole book'}</button><details><summary style={miniButton}>Advanced drafting</summary><div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}><button type="button" disabled={busy} onClick={runPrizeDraft} style={miniButton}><PenLine size={13} /> Opening only</button><button type="button" disabled={busy || !draftPage.trim()} onClick={runContinue} style={miniButton}><PenLine size={13} /> Next beat only</button>{wholeBookRunning && <button type="button" onClick={forgetStaleJob} style={miniButton}><RotateCcw size={13} /> Disconnect stale job</button>}</div></details></div>{draftPage.trim() && <textarea value={draftPage} onChange={(e) => onDraftChange(e.target.value)} rows={14} disabled={wholeBookRunning} style={{ ...darkTextarea, marginTop: 14 }} />}</section>}

      {step === 'finish' && <section style={darkCard}><h3 style={darkH3}>4. Finish the book</h3><p style={darkMuted}>Caspa checks the awkward last mile in the right order: structure and continuity, promises, evidence/research, length, then prose quality.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginBottom: 14 }}><Metric label="Current" value={currentWords.toLocaleString()} /><Metric label="Target" value={targetWords.toLocaleString()} /><Metric label="Still to earn" value={shortfall ? shortfall.toLocaleString() : 'In range'} danger={shortfall > targetWords * .05} /><Metric label="Research added" value={String(addedResearch.length)} /></div>{!finishDiagnosis ? <button type="button" disabled={busy || !draftPage.trim()} onClick={analyseFinish} style={button('#8ea7ff', '#0d111b')}>{busy ? <Loader size={16} className="spin" /> : <Search size={16} />} Analyse the last mile</button> : <div style={{ display: 'grid', gap: 16 }}><div style={{ padding: 13, borderRadius: 12, background: '#0d111b', border: '1px solid #33405c', color: '#dce3f4' }}>{finishDiagnosis.verdict}</div><FinishGroup title="Accepted repairs" action="Select all" onAction={() => setSelectedFixes(finishDiagnosis.recommendations.map((r) => r.id))}>{finishDiagnosis.recommendations.map((r) => <label key={r.id} style={checkRow}><input type="checkbox" checked={selectedFixes.includes(r.id)} onChange={() => setSelectedFixes((p) => p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id])} /><span><strong>{r.title}</strong> <small style={{ color: r.severity === 'critical' ? '#ffaaa3' : '#9eabd0' }}>{r.severity}</small><br /><span style={{ color: '#aeb7ca' }}>{r.detail}</span></span></label>)}</FinishGroup><FinishGroup title="Promises / threads to close" action="Fix all" onAction={() => setSelectedPromises(finishDiagnosis.brokenPromises.map((p) => p.id))}>{finishDiagnosis.brokenPromises.length ? finishDiagnosis.brokenPromises.map((p) => <label key={p.id} style={checkRow}><input type="checkbox" checked={selectedPromises.includes(p.id)} onChange={() => setSelectedPromises((s) => s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id])} /><span><strong>{p.statement}</strong><br /><span style={{ color: '#aeb7ca' }}>{p.fix}</span></span></label>) : <span style={darkMuted}>No broken promises detected.</span>}</FinishGroup><FinishGroup title="Research worth adding" action="Add all" onAction={addAllResearch}>{researchTopics.length ? researchTopics.map((topic) => { const added = addedResearch.includes(topic); return <div key={topic} style={{ ...checkRow, justifyContent: 'space-between' }}><span>{topic}</span><button type="button" disabled={added || Boolean(researchBusy)} onClick={() => addResearchTopic(topic)} style={miniButton}>{researchBusy === topic ? <Loader size={13} className="spin" /> : added ? <Check size={13} /> : <CirclePlus size={13} />} {added ? 'Added' : 'Add'}</button></div>; }) : <span style={darkMuted}>No material research gap detected.</span>}</FinishGroup><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button type="button" disabled={busy || Boolean(researchBusy)} onClick={finishBookToTarget} style={button('#8ea7ff', '#0d111b')}>{busy ? <Loader size={16} className="spin" /> : <Wand2 size={16} />} Apply finish plan</button><button type="button" disabled={busy} onClick={analyseFinish} style={button('#20283a', '#f4f1e9')}><RotateCcw size={16} /> Re-check</button>{finishDone && wordRangeOk && <button type="button" disabled={busy} onClick={runPrizePass} style={button('#26345f', '#f4f1e9')}><ShieldCheck size={16} /> Final quality gate</button>}</div></div>}</section>}

      {step === 'cut' && <section style={darkCard}><h3 style={darkH3}>5. Polish & verify</h3><p style={darkMuted}>Polishing is optional; verification is not. If the draft is already lean, skip the cut and run the final quality gate.</p>{cutPlan && <p style={darkMuted}>Current quality heuristic: {cutPlan.qualityScore}/100 · {cutPlan.needsCut ? `a surgical trim toward ~${cutPlan.suggestedAfterWords.toLocaleString()} words may help.` : 'no material cut is indicated.'}</p>}<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button type="button" disabled={busy || !draftPage.trim() || !wordRangeOk} onClick={runPrizePass} style={button('#8ea7ff', '#0d111b')}><ShieldCheck size={16} /> Final quality gate</button>{cutPlan?.needsCut && <button type="button" disabled={busy || !wordRangeOk} onClick={runCut} style={button('#20283a', '#f4f1e9')}><Scissors size={16} /> Surgical polish</button>}<button type="button" onClick={() => setStep('finish')} style={button('#151b29', '#b9c7ff')}><BookOpenCheck size={16} /> Back to Finish</button></div></section>}

      {step === 'pack' && <section style={darkCard}><h3 style={darkH3}>6. Ready</h3><p style={darkMuted}>{qualityOk && wordRangeOk ? 'Caspa has passed the manuscript through length and final quality gates. Export when ready.' : 'This manuscript has not yet cleared every gate; the safest next action is highlighted above.'}</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginBottom: 14 }}><Metric label="Length" value={wordRangeOk ? 'Pass' : 'Needs work'} danger={!wordRangeOk} /><Metric label="Final quality" value={qualityScore == null ? 'Not checked' : qualityOk ? `Pass · ${qualityScore}` : `Needs work · ${qualityScore}`} danger={!qualityOk} /></div><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button type="button" disabled={!qualityOk || !wordRangeOk} onClick={onGoPublish} style={button('#8ea7ff', '#0d111b')}><Download size={16} /> Publish / export</button><button type="button" onClick={() => setStep('finish')} style={button('#26345f', '#f4f1e9')}><BookOpenCheck size={16} /> Improve again</button><button type="button" onClick={onGoWorkshop} style={button('#20283a', '#f4f1e9')}>Advanced Workshop</button></div></section>}

      {(status || error) && <div style={{ padding: 13, borderRadius: 14, border: `1px solid ${error ? '#d9827b' : '#9aabe8'}`, background: error ? '#fff0ef' : '#edf0ff', color: error ? '#922d25' : '#27366d', lineHeight: 1.45 }}>{error || status}</div>}
      {critic && <details style={darkCard}><summary style={{ cursor: 'pointer', fontWeight: 750 }}>{nonfiction ? 'Editorial gate notes' : 'Prize / critic notes'}</summary><pre style={{ whiteSpace: 'pre-wrap', margin: '14px 0 0', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, color: '#cbd3e7' }}>{critic}</pre></details>}
    </div>
  );
}

function FinishGroup({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: React.ReactNode }) {
  return <div><div style={finishHeader}><strong>{title}</strong><button type="button" onClick={onAction} style={miniButton}>{action}</button></div><div style={{ display: 'grid', gap: 8 }}>{children}</div></div>;
}
function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={{ padding: '11px 13px', borderRadius: 13, background: '#0d111b', border: `1px solid ${danger ? '#a94f49' : '#33405c'}` }}><div style={{ color: '#8f9bb8', fontSize: 10, textTransform: 'uppercase', letterSpacing: .8 }}>{label}</div><div style={{ marginTop: 4, fontSize: 17, fontWeight: 750, color: danger ? '#ffaaa3' : '#f4f1e9' }}>{value}</div></div>;
}
const darkCard: React.CSSProperties = { background: '#151b29', color: '#f4f1e9', border: '1px solid rgba(142,167,255,.20)', borderRadius: 18, padding: 18, boxShadow: '0 14px 34px rgba(13,17,27,.16)' };
const darkH3: React.CSSProperties = { margin: '0 0 8px', fontSize: 18, color: '#f4f1e9' };
const darkMuted: React.CSSProperties = { margin: '0 0 13px', color: '#aeb7ca', lineHeight: 1.5 };
const darkTextarea: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 13, border: '1px solid #33405c', padding: 13, fontSize: 15, lineHeight: 1.55, background: '#0d111b', color: '#f4f1e9', resize: 'vertical' };
const lightInput: React.CSSProperties = { padding: 11, borderRadius: 11, border: '1px solid #c7cfdf', background: '#fff', color: '#182033' };
const labelStyle: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#64708a' };
const finishHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8, color: '#f4f1e9' };
const checkRow: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10, borderRadius: 11, background: '#101623', border: '1px solid #2c3852', color: '#dce3f4', lineHeight: 1.4 };
const miniButton: React.CSSProperties = { display: 'inline-flex', gap: 5, alignItems: 'center', border: '1px solid #465679', background: '#20283a', color: '#dce3f4', borderRadius: 9, padding: '6px 9px', cursor: 'pointer', fontWeight: 650, fontSize: 12 };
function button(bg: string, color: string): React.CSSProperties { return { display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(142,167,255,.24)', background: bg, color, borderRadius: 13, padding: '11px 15px', cursor: 'pointer', fontWeight: 700 }; }

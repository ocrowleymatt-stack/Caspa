/**
 * Quick Write — Seed → Spine → Draft → Finish → Cut → Pack.
 * Whole-book drafting runs as a server background job and is recovered by job id after reloads.
 * Finish is deliberately simple: diagnose → accept fixes/promises → add research → finish to target.
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

type FinishRecommendation = {
  id: string;
  title: string;
  detail: string;
  severity: 'critical' | 'major' | 'minor';
};

type BrokenPromise = {
  id: string;
  statement: string;
  fix: string;
};

type FinishDiagnosis = {
  verdict: string;
  recommendations: FinishRecommendation[];
  brokenPromises: BrokenPromise[];
  researchTopics: string[];
};

type DraftSection = { heading: string; body: string };

function writeModeForBrief(mode: string): string {
  if (mode === 'gold') return 'polish';
  if (mode === 'picture') return 'novel';
  if (['nonfiction', 'essay', 'poetry', 'script', 'musical', 'adaptation', 'chaos', 'novel'].includes(mode)) return mode;
  return 'novel';
}

function isNonfictionMode(mode: string): boolean {
  return mode === 'nonfiction' || mode === 'essay';
}

type Props = {
  brief: {
    title: string;
    mode: string;
    idea: string;
    tone: string;
    output: string;
    targetWordCount?: number;
  };
  draftPage: string;
  onDraftChange: (text: string) => void;
  onTargetWordCountChange?: (n: number) => void;
  onGoPublish: () => void;
  onGoWorkshop: () => void;
  onGoShowBox?: () => void;
};

function stepsForMode(mode: string): Array<{ id: StepId; label: string; detail: string }> {
  const nonfiction = isNonfictionMode(mode);
  return [
    { id: 'seed', label: 'Seed', detail: nonfiction ? 'Capture thesis and question' : 'Capture wound and desire' },
    { id: 'spine', label: 'Spine', detail: nonfiction ? 'Section turns, no prose' : 'Chapter turns, no prose' },
    { id: 'draft', label: 'Draft', detail: 'Write the held manuscript' },
    { id: 'finish', label: 'Finish', detail: 'Fix gaps, broken promises, research and length' },
    { id: 'cut', label: 'Cut', detail: nonfiction ? 'Cut only what weakens the argument' : 'Cut only what weakens the product' },
    { id: 'pack', label: 'Pack', detail: 'Export when ready' },
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
    if (/^#\s+\S/.test(line)) {
      flush();
      heading = line.replace(/^#\s+/, '').trim();
    } else {
      body.push(line);
    }
  }
  flush();
  if (sections.length === 1 && !sections[0].heading) {
    sections[0].heading = 'Manuscript';
  }
  return sections;
}

function joinDraftSections(sections: DraftSection[]): string {
  return sections
    .map((s, i) => `${s.heading ? `# ${s.heading}\n\n` : i ? '' : ''}${s.body.trim()}`.trim())
    .filter(Boolean)
    .join('\n\n');
}

export default function QuickWrite({
  brief,
  draftPage,
  onDraftChange,
  onTargetWordCountChange,
  onGoPublish,
  onGoWorkshop,
  onGoShowBox,
}: Props) {
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
  const [wholeBookJobId, setWholeBookJobId] = useState<string>(() => {
    try { return localStorage.getItem(WHOLE_BOOK_JOB_KEY) || ''; } catch { return ''; }
  });

  const [finishDiagnosis, setFinishDiagnosis] = useState<FinishDiagnosis | null>(null);
  const [selectedFixes, setSelectedFixes] = useState<string[]>([]);
  const [selectedPromises, setSelectedPromises] = useState<string[]>([]);
  const [researchTopics, setResearchTopics] = useState<string[]>([]);
  const [addedResearch, setAddedResearch] = useState<string[]>([]);
  const [researchBusy, setResearchBusy] = useState('');
  const [finishDone, setFinishDone] = useState(false);

  const targetWords = typeof brief.targetWordCount === 'number' && brief.targetWordCount > 0
    ? brief.targetWordCount
    : defaultTargetWordCount(brief.mode);
  const currentWords = useMemo(() => countWords(draftPage), [draftPage]);
  const shortfall = Math.max(0, targetWords - currentWords);
  const wholeBookRunning = Boolean(wholeBookJobId);
  const projectBrief = useMemo(() => ({ ...brief, audience: 'General reader', targetWordCount: targetWords }), [brief, targetWords]);
  const projectKey = useMemo(() => getProjectKey(projectBrief), [projectBrief]);

  useEffect(() => {
    fetch('/api/caspa/write/awards')
      .then((r) => readApiJson<any>(r))
      .then((j) => {
        if (!j?.data?.lenses?.length) return;
        setLenses(j.data.lenses);
        const ids = j.data.lenses.map((l: AwardLens) => l.id) as string[];
        if (mode === 'essay' && ids.includes('essay-orwell')) setPrizeLensId((p) => p === 'booker-literary' ? 'essay-orwell' : p);
        else if (nonfiction && ids.includes('pulitzer-nonfiction')) setPrizeLensId((p) => p === 'booker-literary' ? 'pulitzer-nonfiction' : p);
      })
      .catch(() => {});
  }, [mode, nonfiction]);

  useEffect(() => {
    if (!draftPage.trim()) setCutPlan(null);
    else setCutPlan(planQualityCut(draftPage, { mode, targetWordCount: targetWords }));
  }, [draftPage, mode, targetWords]);

  useEffect(() => {
    if (!wholeBookJobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clearJob = () => {
      try { localStorage.removeItem(WHOLE_BOOK_JOB_KEY); } catch {}
      if (!cancelled) setWholeBookJobId('');
    };

    const poll = async () => {
      try {
        const response = await fetch(`/api/caspa/write/whole-book/job/${encodeURIComponent(wholeBookJobId)}`, { cache: 'no-store' });
        const json = await readApiJson<any>(response);
        if (!response.ok || !json.success) throw new Error(json.message || 'Could not read whole-book job.');
        const job = json.data;
        const result = job?.result || {};
        const done = Number(result.done || 0);
        const total = Math.max(1, Number(result.total || 1));
        const title = String(result.currentTitle || job.stage || 'Working');
        if (result.manuscript && typeof result.manuscript === 'string') onDraftChange(result.manuscript);
        if (result.plotHold?.beats) {
          const held = savePlotHold(result.plotHold as PlotHold);
          setPlotHold(held);
        }
        setBookProgress({ done, total, title });
        setStatus(`Background draft ${done}/${total} · ${Number(result.words || 0).toLocaleString()}/${targetWords.toLocaleString()} words · ${title}`);

        if (job.status === 'complete') {
          if (result.finalText || result.manuscript) onDraftChange(String(result.finalText || result.manuscript));
          if (result.score != null) setQualityScore(Number(result.score));
          setBookProgress({ done: total, total, title: 'Complete' });
          setStep('finish');
          setFinishDiagnosis(null);
          setFinishDone(false);
          setStatus(`Draft complete: ${Number(result.words || countWords(String(result.finalText || ''))).toLocaleString()} / ${targetWords.toLocaleString()} words. Finish checks length, research, recommendations and broken promises next.`);
          setBusy(false);
          clearJob();
          return;
        }
        if (job.status === 'failed') {
          setStep('draft');
          setBusy(false);
          setError(`${job.error || 'Whole-book job failed'} — completed material has been kept. Start again to continue remaining ${nonfiction ? 'sections' : 'chapters'}.`);
          clearJob();
          return;
        }
      } catch {
        setStatus('Background draft is still registered. Reconnecting…');
      }
      if (!cancelled) timer = setTimeout(poll, 2000);
    };

    setBusy(true);
    setStep('draft');
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [wholeBookJobId, nonfiction, onDraftChange, targetWords]);

  const sharedWriteBody = (hold: PlotHold | null, focus?: { title: string; turn: string } | null) => {
    const basePremise = proposal?.premise || hold?.premise || seed || brief.idea;
    const showPack = mode === 'musical' || mode === 'script' ? formatShowPackForWriting() : '';
    return {
      mode,
      genre: proposal?.genre || hold?.genre || (nonfiction ? 'Creative Non-Fiction' : mode === 'musical' ? 'Musical / Show' : mode === 'script' ? 'Stage Play' : 'Literary fiction'),
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
    setBusy(true); setError(''); setStatus(nonfiction ? 'Expanding seed into a non-fiction proposal…' : 'Expanding seed into a prize-ambition proposal…');
    try {
      const res = await fetchWithTimeout('/api/caspa/write/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seed, mode }) }, AI_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.success) throw new Error(json.message || 'Seed failed');
      setProposal(json.data);
      const held = plotHoldFromProposal(json.data || {}, brief.title);
      setPlotHold(held);
      if (json.data?.premise) setSeed(json.data.premise);
      setStep('spine');
      setStatus(`Plot held. ${plotHoldSummary(held)}`);
    } catch (err) { setError(friendlyFetchError(err, 'Seed failed')); }
    finally { setBusy(false); }
  };

  const runPrizeDraft = async () => {
    setBusy(true); setError(''); setStatus(nonfiction ? 'Drafting opening section…' : 'Drafting opening chapter…');
    try {
      const hold = plotHold || loadPlotHold();
      const focus = nextPendingBeat(hold);
      const res = await fetchWithTimeout('/api/caspa/write/prize-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sharedWriteBody(hold, focus), output: nonfiction ? 'Full opening section for the current focus beat' : 'Full opening chapter for the current focus beat', sourceText: draftPage }),
      }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.success) throw new Error(json.message || 'Draft failed');
      const text = json.data.text || '';
      onDraftChange(text);
      if (hold && focus) setPlotHold(markBeatDrafted(focus.id));
      setCritic(json.data.criticReport || '');
      setQualityScore(json.data.quality?.overallScore ?? null);
      setStep('draft');
      setStatus(`Drafted ${Number(json.data.wordCount || countWords(text)).toLocaleString()} words.`);
    } catch (err) { setError(friendlyFetchError(err, 'Draft failed')); }
    finally { setBusy(false); }
  };

  const runContinue = async () => {
    setBusy(true); setError(''); setStatus('Continuing next beat…');
    try {
      const hold = plotHold || loadPlotHold();
      const focus = nextPendingBeat(hold);
      const res = await fetchWithTimeout('/api/caspa/write/continue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sharedWriteBody(hold, focus), sourceText: draftPage, wholeBook: false }),
      }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.success) throw new Error(json.message || 'Continue failed');
      const next = json.data.text || '';
      const heading = sectionHeading(json.data.beatTitle || focus?.title || '', (hold?.beats || []).findIndex((b) => b.title === focus?.title), mode);
      onDraftChange(`${draftPage.trim()}${heading}${next}`.trim());
      if (hold && focus) setPlotHold(markBeatDrafted(focus.id));
      setStatus(`Added ${Number(json.data.wordCount || countWords(next)).toLocaleString()} words.`);
    } catch (err) { setError(friendlyFetchError(err, 'Continue failed')); }
    finally { setBusy(false); }
  };

  const runWholeBook = async () => {
    setError('');
    const hold = plotHold || loadPlotHold();
    if (!hold?.beats?.length) { setError(nonfiction ? 'Expand a seed into a spine first.' : 'Expand a seed into a plot hold first.'); return; }
    setBusy(true);
    setStep('draft');
    setStatus('Starting background whole-book job…');
    try {
      const res = await fetch('/api/caspa/write/whole-book/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sharedWriteBody(hold, null), sourceText: draftPage, wholeBook: true }),
      });
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.success || !json.jobId) throw new Error(json.message || 'Could not start whole-book job');
      try { localStorage.setItem(WHOLE_BOOK_JOB_KEY, json.jobId); } catch {}
      setWholeBookJobId(json.jobId);
      const pending = hold.beats.filter((b) => b.status !== 'drafted');
      setBookProgress({ done: 0, total: pending.length || hold.beats.length, title: 'Queued' });
      setStatus('Whole-book job started. You can leave this page; Caspa will reconnect when you return.');
    } catch (err) {
      setBusy(false);
      setError(friendlyFetchError(err, 'Whole-book job could not start'));
    }
  };

  const forgetStaleJob = () => {
    try { localStorage.removeItem(WHOLE_BOOK_JOB_KEY); } catch {}
    setWholeBookJobId('');
    setBusy(false);
    setBookProgress(null);
    setStatus('Background-job link cleared. Existing draft kept.');
  };

  const analyseFinish = async () => {
    if (!draftPage.trim()) { setError('There is no manuscript to finish yet.'); return; }
    setBusy(true); setError(''); setFinishDone(false);
    setStatus('Reading the completed draft for gaps, broken promises and missing research…');
    try {
      const prompt = `You are Caspa's final commissioning editor. Diagnose this manuscript for FINISHING, not for starting over.

TITLE: ${brief.title}
MODE: ${mode}
PREMISE: ${brief.idea}
TARGET LENGTH: ${targetWords.toLocaleString()} words
CURRENT LENGTH: ${currentWords.toLocaleString()} words
SHORTFALL: ${shortfall.toLocaleString()} words

MANUSCRIPT:
${draftPage.slice(0, 110000)}

Return JSON only:
{
  "verdict":"direct 2-3 sentence verdict",
  "recommendations":[{"id":"rec-1","title":"...","detail":"specific fix","severity":"critical|major|minor"}],
  "brokenPromises":[{"id":"promise-1","statement":"what the book promised the reader","fix":"how to pay it off or deliberately close it"}],
  "researchTopics":["specific research question or evidence gap"]
}

Rules:
- Recommend FINISHING actions, not vague critique.
- If materially under target, make substantive expansion a critical recommendation: evidence/examples/counterargument for nonfiction; scene/causality/character/payoff for fiction. Never filler.
- Identify promises that were planted but not paid off.
- Identify factual or contextual gaps where research would materially improve authority.
- Give 3-7 recommendations, 0-6 broken promises and 0-6 research topics.`;

      const res = await fetchWithTimeout('/api/ai/call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, json: true, maxTokens: 5200 }),
      }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.result) throw new Error(json.message || 'Finish analysis failed');
      const parsed = parseJsonLoose(String(json.result));
      const recs: FinishRecommendation[] = Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map((r: any, i: number) => ({
            id: String(r.id || `rec-${i + 1}`),
            title: String(r.title || 'Improve manuscript'),
            detail: String(r.detail || ''),
            severity: ['critical', 'major', 'minor'].includes(r.severity) ? r.severity : 'major',
          }))
        : [];
      if (shortfall > Math.round(targetWords * 0.03) && !recs.some((r) => /word|length|expand|short/i.test(`${r.title} ${r.detail}`))) {
        recs.unshift({
          id: 'rec-hit-target',
          title: `Recover the missing ${shortfall.toLocaleString()} words`,
          detail: nonfiction
            ? 'Deepen evidence, examples, counterargument, practical detail and source-aware caveats until the manuscript earns its target length. No padding.'
            : 'Deepen causal scenes, character pressure, dialogue conflict, setting and promised payoffs until the manuscript earns its target length. No padding.',
          severity: 'critical',
        });
      }
      const promises: BrokenPromise[] = Array.isArray(parsed.brokenPromises)
        ? parsed.brokenPromises.map((p: any, i: number) => ({ id: String(p.id || `promise-${i + 1}`), statement: String(p.statement || ''), fix: String(p.fix || '') })).filter((p: BrokenPromise) => p.statement)
        : [];
      let topics: string[] = Array.isArray(parsed.researchTopics) ? parsed.researchTopics.map(String).filter(Boolean) : [];
      try {
        const suggested = await suggestResearchTopics(projectBrief as any, draftPage.slice(0, 18000));
        topics = [...new Set([...topics, ...suggested])].slice(0, 8);
      } catch {}
      const diagnosis: FinishDiagnosis = {
        verdict: String(parsed.verdict || 'Finish analysis complete.'),
        recommendations: recs,
        brokenPromises: promises,
        researchTopics: topics,
      };
      setFinishDiagnosis(diagnosis);
      setSelectedFixes(recs.map((r) => r.id));
      setSelectedPromises(promises.map((p) => p.id));
      setResearchTopics(topics);
      setStatus('Finish plan ready. Untick anything you do not want, add useful research, then press Finish book to target.');
    } catch (err) {
      setError(friendlyFetchError(err, 'Could not analyse the finish'));
    } finally {
      setBusy(false);
    }
  };

  const addResearchTopic = async (topic: string) => {
    if (!topic || addedResearch.includes(topic)) return;
    setResearchBusy(topic); setError(''); setStatus(`Researching: ${topic}`);
    try {
      const note = await deepResearchTopic(topic, projectBrief as any, draftPage.slice(0, 15000));
      addNote(projectKey, note);
      setAddedResearch((prev) => [...prev, topic]);
      setStatus(`Research added: ${topic}`);
    } catch (err) {
      setError(friendlyFetchError(err, 'Research failed'));
    } finally {
      setResearchBusy('');
    }
  };

  const addAllResearch = async () => {
    for (const topic of researchTopics) {
      if (!addedResearch.includes(topic)) await addResearchTopic(topic);
    }
  };

  const finishBookToTarget = async () => {
    if (!finishDiagnosis) { await analyseFinish(); return; }
    const sections = splitDraftSections(draftPage);
    if (!sections.length) { setError('Could not find manuscript sections to finish.'); return; }
    setBusy(true); setError(''); setFinishDone(false);
    const fixes = finishDiagnosis.recommendations.filter((r) => selectedFixes.includes(r.id));
    const promises = finishDiagnosis.brokenPromises.filter((p) => selectedPromises.includes(p.id));
    const notes = loadLibrary(projectKey).slice(-8);
    const researchBlock = notes.length
      ? notes.map((n) => `RESEARCH: ${n.title}\n${String(n.content || '').slice(0, 3500)}`).join('\n\n')
      : 'No additional research notes supplied.';
    const originalWords = sections.map((s) => countWords(s.body));
    const gap = Math.max(0, targetWords - originalWords.reduce((a, b) => a + b, 0));
    let working = sections.map((s) => ({ ...s }));

    try {
      for (let i = 0; i < working.length; i++) {
        const original = originalWords[i];
        const extra = gap > 0 ? Math.ceil(gap / working.length) : 0;
        const target = Math.max(original, original + extra);
        const section = working[i];
        setStatus(`Finishing ${section.heading || `section ${i + 1}`} (${i + 1}/${working.length}) · aiming ~${target.toLocaleString()} words…`);

        const prompt = `You are Caspa's finishing editor. Return the COMPLETE revised section only.

BOOK: ${brief.title}
MODE: ${mode}
SECTION: ${section.heading || i + 1}
CURRENT SECTION WORDS: ${original.toLocaleString()}
TARGET FOR THIS FINISH PASS: approximately ${target.toLocaleString()} words
BOOK TARGET: ${targetWords.toLocaleString()} words

APPROVED EDITORIAL FIXES:
${fixes.length ? fixes.map((r) => `- ${r.title}: ${r.detail}`).join('\n') : '- Preserve what already works; make only necessary improvements.'}

BROKEN / OPEN PROMISES THE AUTHOR ACCEPTED FOR REPAIR:
${promises.length ? promises.map((p) => `- ${p.statement} -> ${p.fix}`).join('\n') : '- None specifically selected.'}

RESEARCH LIBRARY:
${researchBlock}

EXISTING SECTION:
${section.body.slice(0, 70000)}

RULES:
- Preserve the author's voice, factual position and existing useful material.
- Integrate research only where relevant; never dump notes or invent citations.
- Pay off selected promises where this section can genuinely do so.
- If the book is under target, expansion must add substance, not filler or repetition.
- Do not summarise the section. Do not include editorial commentary, headings, word counts or preamble.
- Do not make the section shorter when the manuscript is under target.
- Return only the complete replacement prose for this section.`;

        const res = await fetchWithTimeout('/api/ai/call', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, maxTokens: Math.min(28000, Math.max(6000, Math.round(target * 1.7))) }),
        }, AI_LONG_FETCH_TIMEOUT_MS);
        const json = await readApiJson<any>(res);
        if (!res.ok || !json.result) throw new Error(json.message || `Finish failed on ${section.heading || i + 1}`);
        const revised = String(json.result).trim();
        if (revised) working[i].body = revised;
        onDraftChange(joinDraftSections(working));
      }

      const finalText = joinDraftSections(working);
      const finalWords = countWords(finalText);
      onDraftChange(finalText);
      setFinishDone(true);
      setStatus(`Finish pass complete: ${finalWords.toLocaleString()} / ${targetWords.toLocaleString()} words. ${finalWords < targetWords * 0.95 ? 'Still short: run Finish book to target once more; it will redistribute the remaining gap.' : 'Length is now in range. Review, then cut only if something genuinely needs cutting.'}`);
    } catch (err) {
      setError(`${friendlyFetchError(err, 'Finish pass failed')} — completed sections have been kept; press Finish book to target again to continue improving.`);
    } finally {
      setBusy(false);
    }
  };

  const runCut = async () => {
    if (!draftPage.trim()) { setError('Nothing to cut yet. Draft first.'); return; }
    if (currentWords < targetWords * 0.95) { setStep('finish'); setError(`This manuscript is ${shortfall.toLocaleString()} words short. Finish it before cutting it.`); return; }
    setBusy(true); setError('');
    const plan = planQualityCut(draftPage, { mode, targetWordCount: targetWords });
    setCutPlan(plan);
    setStatus(plan.needsCut ? `Cutting by need — ${plan.reasons[0] || 'strengthen the product'}…` : 'Surgical polish only — no forced percentage…');
    try {
      const res = await fetchWithTimeout('/api/caspa/write/cut', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: draftPage, mode, targetWordCount: targetWords }) }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.success) throw new Error(json.message || 'Cut failed');
      onDraftChange(json.data.text || '');
      setStep('pack');
      setStatus(`Cut ${json.data.beforeWords} → ${json.data.afterWords} words.`);
    } catch (err) { setError(friendlyFetchError(err, 'Cut failed')); }
    finally { setBusy(false); }
  };

  const runPrizePass = async () => {
    if (!draftPage.trim()) return;
    setBusy(true); setError(''); setStatus(nonfiction ? 'Quality pass assessing readiness…' : 'Prize pass assessing readiness…');
    try {
      const res = await fetchWithTimeout('/api/caspa/write/prize-pass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: draftPage, prizeLensId, title: brief.title, mode, targetWordCount: targetWords }) }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.success) throw new Error(json.message || 'Prize pass failed');
      setQualityScore(Number(json.data.assessment?.overallReadiness || json.data.quality?.overallScore || 0));
      setCritic([json.data.assessment?.judgeComment, ...(json.data.assessment?.fixes || []).map((f: string, i: number) => `${i + 1}. ${f}`)].filter(Boolean).join('\n'));
      setStatus(json.data.readyEnough ? 'Ready enough to export.' : 'Not ready yet — use Finish for accepted fixes, research and promises, then re-pass.');
    } catch (err) { setError(friendlyFetchError(err, 'Prize pass failed')); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'grid', gap: 20, color: '#f4f1e9' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 28, letterSpacing: -0.6, color: '#182033' }}>Just write</h2>
        <p style={{ margin: '8px 0 0', color: '#64708a', maxWidth: 760 }}>
          Seed → spine → draft → finish → cut → pack. Finish is where Caspa closes the word gap, lets you accept recommendations and broken promises, and adds research before the manuscript is called done. · {currentWords.toLocaleString()} / {targetWords.toLocaleString()} words
        </p>
      </div>

      {(mode === 'musical' || showPackLive) && (
        <div style={{ ...darkCard, padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={darkMuted}>{showPackLive ? 'Show in a Box pack is live — drafts honour song list, running order, and cast.' : 'Pack the show first, then draft scenes that turn into numbers.'}</span>
          {onGoShowBox && <button type="button" onClick={onGoShowBox} style={button('#8ea7ff', '#0d111b')}>Open Show in a Box</button>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STEPS.map((s) => {
          const active = s.id === step;
          const idx = STEPS.findIndex((x) => x.id === s.id);
          const currentIdx = STEPS.findIndex((x) => x.id === step);
          const done = idx < currentIdx;
          return (
            <button key={s.id} type="button" onClick={() => setStep(s.id)} title={s.detail} style={{ border: active ? '2px solid #8ea7ff' : '1px solid #c7cfdf', background: active ? '#e8ecff' : done ? '#eef1f7' : '#fff', color: '#182033', borderRadius: 999, padding: '8px 14px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', fontWeight: active ? 700 : 500 }}>
              {done ? <Check size={14} /> : null}{s.label}
            </button>
          );
        })}
      </div>

      {plotHold && <div style={{ fontSize: 13, color: '#64708a' }}>Plot hold: {plotHoldSummary(plotHold)}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <label style={{ display: 'grid', gap: 6, maxWidth: 420, flex: '1 1 240px' }}>
          <span style={labelStyle}>{nonfiction ? 'Quality lens' : 'Prize lens'}</span>
          <select value={prizeLensId} onChange={(e) => setPrizeLensId(e.target.value)} style={lightInput}>
            {lenses.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, maxWidth: 220, flex: '0 1 180px' }}>
          <span style={labelStyle}>Aspire-to words</span>
          <input type="number" min={100} step={500} value={targetWords} onChange={(e) => onTargetWordCountChange?.(Math.max(100, Number(e.target.value) || 100))} disabled={!onTargetWordCountChange} style={{ ...lightInput, fontWeight: 600 }} />
        </label>
      </div>

      {step === 'seed' && (
        <section style={darkCard}>
          <h3 style={darkH3}>1. Seed</h3>
          <p style={darkMuted}>{nonfiction ? 'One paragraph: thesis, question, concrete pressure. Thin input is fine.' : 'One paragraph: wound, desire, place. Thin input is fine.'}</p>
          <textarea value={seed} onChange={(e) => setSeed(e.target.value)} rows={6} style={darkTextarea} />
          <button type="button" disabled={busy || !seed.trim()} onClick={runSeed} style={button('#8ea7ff', '#0d111b')}>{busy ? <Loader size={16} className="spin" /> : <Sparkles size={16} />} Expand into proposal</button>
        </section>
      )}

      {step === 'spine' && (
        <section style={darkCard}>
          <h3 style={darkH3}>2. Spine</h3>
          {proposal ? <div style={{ display: 'grid', gap: 12 }}>
            <strong>{proposal.title || brief.title}</strong>
            <p style={{ margin: 0 }}>{proposal.premise}</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{(proposal.chapters || proposal.scenePlan || []).slice(0, 12).map((ch: any, i: number) => <li key={i} style={{ marginBottom: 6 }}>{typeof ch === 'string' ? ch : `${ch.title || `Beat ${i + 1}`}: ${ch.turn || ch.endingImage || ''}`}</li>)}</ul>
            <button type="button" onClick={() => setStep('draft')} style={button('#8ea7ff', '#0d111b')}><PenLine size={16} /> Accept spine → draft</button>
          </div> : <div><p style={darkMuted}>No spine yet. Expand a seed first, or jump straight to draft.</p><button type="button" onClick={() => setStep('draft')} style={button('#20283a', '#f4f1e9')}>Skip to draft</button></div>}
        </section>
      )}

      {step === 'draft' && (
        <section style={darkCard}>
          <h3 style={darkH3}>3. Whole-book draft</h3>
          <p style={darkMuted}>Starts once, returns immediately, then works beat-by-beat on the server. Close the tab if you like; reopening Caspa reconnects to the job and restores completed material.</p>
          {bookProgress && <div style={{ marginBottom: 14, color: '#cbd3e7', fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{bookProgress.done}/{bookProgress.total} — <strong>{bookProgress.title}</strong></span><span>{Math.round((bookProgress.done / Math.max(1, bookProgress.total)) * 100)}%</span></div>
            <div style={{ marginTop: 8, height: 9, borderRadius: 999, background: '#293249', overflow: 'hidden' }}><div style={{ width: `${Math.round((bookProgress.done / Math.max(1, bookProgress.total)) * 100)}%`, height: '100%', background: '#8ea7ff', transition: 'width .35s ease' }} /></div>
          </div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" disabled={wholeBookRunning} onClick={runWholeBook} style={button('#8ea7ff', '#0d111b')}>{wholeBookRunning ? <Loader size={16} className="spin" /> : <Wand2 size={16} />}{wholeBookRunning ? ' Writing in background…' : ' Write whole book'}</button>
            <button type="button" disabled={busy} onClick={runPrizeDraft} style={button('#20283a', '#f4f1e9')}><PenLine size={16} /> Opening {nonfiction ? 'section' : 'chapter'} only</button>
            <button type="button" disabled={busy || !draftPage.trim()} onClick={runContinue} style={button('#151b29', '#b9c7ff')}><PenLine size={16} /> Continue next beat</button>
            <button type="button" disabled={!draftPage.trim() || wholeBookRunning} onClick={() => { setStep('finish'); setFinishDiagnosis(null); setFinishDone(false); }} style={button('#26345f', '#f4f1e9')}><BookOpenCheck size={16} /> Finish this manuscript</button>
            {wholeBookRunning && <button type="button" onClick={forgetStaleJob} title="Only use this if the server job no longer exists" style={button('#151b29', '#aeb7ca')}><RotateCcw size={16} /> Disconnect view</button>}
          </div>
          {draftPage.trim() && <textarea value={draftPage} onChange={(e) => onDraftChange(e.target.value)} rows={16} disabled={wholeBookRunning} style={{ ...darkTextarea, marginTop: 14, opacity: wholeBookRunning ? .82 : 1 }} />}
        </section>
      )}

      {step === 'finish' && (
        <section style={darkCard}>
          <h3 style={darkH3}>4. Finish the book</h3>
          <p style={darkMuted}>One screen for the awkward last mile: close the word gap, accept the fixes you agree with, repair promises, add research, then let Caspa improve the manuscript section by section.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 16 }}>
            <Metric label="Current" value={currentWords.toLocaleString()} />
            <Metric label="Target" value={targetWords.toLocaleString()} />
            <Metric label="Gap" value={shortfall ? shortfall.toLocaleString() : 'In range'} danger={shortfall > targetWords * .05} />
            <Metric label="Research added" value={String(addedResearch.length)} />
          </div>

          {!finishDiagnosis ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <p style={darkMuted}>Caspa will produce a short finish plan: recommendations, broken promises and research gaps. Nothing is changed until you accept it.</p>
              <button type="button" disabled={busy || !draftPage.trim()} onClick={analyseFinish} style={button('#8ea7ff', '#0d111b')}>
                {busy ? <Loader size={16} className="spin" /> : <Search size={16} />} Analyse what is still missing
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ padding: 14, borderRadius: 14, background: '#0d111b', border: '1px solid #33405c', color: '#dce3f4', lineHeight: 1.5 }}>{finishDiagnosis.verdict}</div>

              <div>
                <div style={finishHeader}><strong>Recommendations</strong><button type="button" onClick={() => setSelectedFixes(finishDiagnosis.recommendations.map((r) => r.id))} style={miniButton}>Accept all</button></div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {finishDiagnosis.recommendations.map((r) => (
                    <label key={r.id} style={checkRow}>
                      <input type="checkbox" checked={selectedFixes.includes(r.id)} onChange={() => setSelectedFixes((prev) => prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id])} />
                      <span><strong>{r.title}</strong> <small style={{ color: r.severity === 'critical' ? '#ffaaa3' : '#9eabd0' }}>{r.severity}</small><br /><span style={{ color: '#aeb7ca' }}>{r.detail}</span></span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div style={finishHeader}><strong>Promises the draft has not paid off</strong><button type="button" onClick={() => setSelectedPromises(finishDiagnosis.brokenPromises.map((p) => p.id))} style={miniButton}>Fix all</button></div>
                {finishDiagnosis.brokenPromises.length ? <div style={{ display: 'grid', gap: 8 }}>
                  {finishDiagnosis.brokenPromises.map((p) => (
                    <label key={p.id} style={checkRow}>
                      <input type="checkbox" checked={selectedPromises.includes(p.id)} onChange={() => setSelectedPromises((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])} />
                      <span><strong>{p.statement}</strong><br /><span style={{ color: '#aeb7ca' }}>{p.fix}</span></span>
                    </label>
                  ))}
                </div> : <p style={darkMuted}>No clear broken promises detected.</p>}
              </div>

              <div>
                <div style={finishHeader}><strong>Research worth adding</strong><button type="button" disabled={Boolean(researchBusy)} onClick={addAllResearch} style={miniButton}><CirclePlus size={13} /> Add all useful research</button></div>
                {researchTopics.length ? <div style={{ display: 'grid', gap: 8 }}>
                  {researchTopics.map((topic) => {
                    const added = addedResearch.includes(topic);
                    return <div key={topic} style={{ ...checkRow, justifyContent: 'space-between' }}><span style={{ paddingRight: 12 }}>{topic}</span><button type="button" disabled={added || Boolean(researchBusy)} onClick={() => addResearchTopic(topic)} style={miniButton}>{researchBusy === topic ? <Loader size={13} className="spin" /> : added ? <Check size={13} /> : <CirclePlus size={13} />}{added ? ' Added' : ' Add'}</button></div>;
                  })}
                </div> : <p style={darkMuted}>No material research gap detected.</p>}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" disabled={busy || Boolean(researchBusy)} onClick={finishBookToTarget} style={button('#8ea7ff', '#0d111b')}>
                  {busy ? <Loader size={16} className="spin" /> : <Wand2 size={16} />} Finish book to target
                </button>
                <button type="button" disabled={busy} onClick={analyseFinish} style={button('#20283a', '#f4f1e9')}><RotateCcw size={16} /> Re-analyse</button>
                {finishDone && <button type="button" onClick={() => setStep('cut')} style={button('#26345f', '#f4f1e9')}><Scissors size={16} /> Review / cut next</button>}
                {finishDone && <button type="button" onClick={() => setStep('pack')} style={button('#151b29', '#b9c7ff')}><Download size={16} /> Pack if satisfied</button>}
              </div>
            </div>
          )}
        </section>
      )}

      {step === 'cut' && (
        <section style={darkCard}>
          <h3 style={darkH3}>5. Cut</h3>
          <p style={darkMuted}>{currentWords < targetWords * .95 ? 'The book is still short. Finish it before cutting.' : 'Cut sludge by need — not a fixed percentage. Keep voice and turns.'}</p>
          {cutPlan && <div style={{ ...darkMuted, marginBottom: 14 }}>{cutPlan.needsCut ? `Quality ${cutPlan.qualityScore}/100 · lean toward ~${cutPlan.suggestedAfterWords.toLocaleString()} words if that improves the work.` : `Quality ${cutPlan.qualityScore}/100 · surgical polish only.`}</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy || !draftPage.trim() || currentWords < targetWords * .95} onClick={runCut} style={button('#8ea7ff', '#0d111b')}>{busy ? <Loader size={16} className="spin" /> : <Scissors size={16} />} Cut & tighten</button>
            <button type="button" onClick={() => setStep('finish')} style={button('#26345f', '#f4f1e9')}><BookOpenCheck size={16} /> Back to Finish</button>
            <button type="button" disabled={busy || !draftPage.trim()} onClick={runPrizePass} style={button('#20283a', '#f4f1e9')}>{nonfiction ? 'Quality pass' : 'Prize pass'}</button>
          </div>
          <textarea value={draftPage} onChange={(e) => onDraftChange(e.target.value)} rows={14} style={{ ...darkTextarea, marginTop: 14 }} />
        </section>
      )}

      {step === 'pack' && (
        <section style={darkCard}>
          <h3 style={darkH3}>6. Pack</h3>
          <p style={darkMuted}>Export when the draft earns it. If recommendations, promises or research are still unresolved, Finish takes you straight back to them.</p>
          {qualityScore != null && <p style={{ margin: '0 0 12px', fontWeight: 700 }}>Readiness score: {qualityScore}/100</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={onGoPublish} style={button('#8ea7ff', '#0d111b')}><Download size={16} /> Publish pack</button>
            <button type="button" onClick={() => setStep('finish')} style={button('#26345f', '#f4f1e9')}><BookOpenCheck size={16} /> Finish / improve again</button>
            <button type="button" onClick={onGoWorkshop} style={button('#20283a', '#f4f1e9')}>Advanced Workshop</button>
            <button type="button" disabled={busy || !draftPage.trim()} onClick={runPrizePass} style={button('#151b29', '#b9c7ff')}>Re-run {nonfiction ? 'quality' : 'prize'} pass</button>
          </div>
        </section>
      )}

      {(status || error) && <div style={{ padding: 13, borderRadius: 14, border: `1px solid ${error ? '#d9827b' : '#9aabe8'}`, background: error ? '#fff0ef' : '#edf0ff', color: error ? '#922d25' : '#27366d', lineHeight: 1.45 }}>{error || status}</div>}
      {critic && <section style={darkCard}><h3 style={darkH3}>{nonfiction ? 'Assessor notes' : 'Critic / prize notes'}</h3><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, color: '#cbd3e7' }}>{critic}</pre></section>}
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={{ padding: '12px 14px', borderRadius: 14, background: '#0d111b', border: `1px solid ${danger ? '#a94f49' : '#33405c'}` }}><div style={{ color: '#8f9bb8', fontSize: 11, textTransform: 'uppercase', letterSpacing: .8 }}>{label}</div><div style={{ marginTop: 4, fontSize: 18, fontWeight: 750, color: danger ? '#ffaaa3' : '#f4f1e9' }}>{value}</div></div>;
}

const darkCard: React.CSSProperties = {
  background: '#151b29', color: '#f4f1e9', border: '1px solid rgba(142,167,255,.20)', borderRadius: 20, padding: 20,
  boxShadow: '0 18px 42px rgba(13,17,27,.18)',
};
const darkH3: React.CSSProperties = { margin: '0 0 8px', fontSize: 18, color: '#f4f1e9' };
const darkMuted: React.CSSProperties = { margin: '0 0 14px', color: '#aeb7ca', lineHeight: 1.5 };
const darkTextarea: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 14, border: '1px solid #33405c', padding: 14, fontSize: 15, lineHeight: 1.55, background: '#0d111b', color: '#f4f1e9', resize: 'vertical' };
const lightInput: React.CSSProperties = { padding: 12, borderRadius: 12, border: '1px solid #c7cfdf', background: '#fff', color: '#182033' };
const labelStyle: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#64708a' };
const finishHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 9, color: '#f4f1e9' };
const checkRow: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', padding: 11, borderRadius: 12, background: '#101623', border: '1px solid #2c3852', color: '#dce3f4', lineHeight: 1.4 };
const miniButton: React.CSSProperties = { display: 'inline-flex', gap: 5, alignItems: 'center', border: '1px solid #465679', background: '#20283a', color: '#dce3f4', borderRadius: 9, padding: '6px 9px', cursor: 'pointer', fontWeight: 650, fontSize: 12 };
function button(bg: string, color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(142,167,255,.24)', background: bg, color, borderRadius: 14, padding: '12px 16px', cursor: 'pointer', fontWeight: 650 };
}

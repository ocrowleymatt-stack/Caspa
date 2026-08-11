import fs from 'node:fs';
import path from 'node:path';

const JOB_ID = process.env.CASPA_SOURCE_JOB_ID || '5afbd817-fee6-46cd-aa26-2274bee58052';
const JOBS = process.env.CASPA_JOBS_FILE || '/root/Caspa/data/caspa-jobs.json';
const STATE = process.env.CASPA_EVERYMAN_STATE || '/root/Caspa/data/everyman-humanise-state.json';
const OUT = process.env.CASPA_EVERYMAN_OUT || '/root/Caspa/exports/chemsex-everyman-guide.md';
const PORT = Number(process.env.PORT || 3000);
const TARGET_WORDS = Number(process.env.TARGET_WORDS || 70000);

function words(s='') { return String(s).trim().split(/\s+/).filter(Boolean).length; }
function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

async function ai(prompt, maxTokens=16000) {
  let last;
  for (let attempt=1; attempt<=3; attempt++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/ai/call`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          prompt,
          maxTokens,
          intelligenceMode:'balanced',
          taskHint:'factual',
          useWebSearch:true,
          skipLocalFallback:true
        }),
        signal: AbortSignal.timeout(360000),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.result) throw new Error(j.message || `AI call failed ${r.status}`);
      return String(j.result).trim();
    } catch (e) {
      last = e;
      console.warn(`AI attempt ${attempt}/3 failed: ${e.message}`);
      await new Promise(r => setTimeout(r, attempt * 5000));
    }
  }
  throw last;
}

function loadSourceChapters() {
  const store = JSON.parse(fs.readFileSync(JOBS, 'utf8'));
  const jobs = Array.isArray(store) ? store : store.jobs;
  if (!Array.isArray(jobs)) throw new Error('Unexpected caspa-jobs.json shape');
  const job = jobs.find(j => j.id === JOB_ID);
  if (!job) throw new Error(`Source job ${JOB_ID} not found`);
  const result = job.result || {};
  const chapters = result.chapters || (job.checkpoint || {}).chapters || [];
  if (!Array.isArray(chapters) || !chapters.length) throw new Error('No source chapters found');
  return chapters.slice().sort((a,b)=>(a.order||0)-(b.order||0)).map((c,i)=>({
    order: Number.isFinite(c.order) ? c.order : i,
    title: c.title || `Chapter ${i+1}`,
    content: String(c.content || ''),
  }));
}

const source = loadSourceChapters();
const sourceTotal = source.reduce((n,c)=>n+words(c.content),0);
const scale = Math.max(1, TARGET_WORDS / Math.max(1, sourceTotal));
let state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE,'utf8')) : {
  version: 1,
  sourceJobId: JOB_ID,
  targetWords: TARGET_WORDS,
  sourceWords: sourceTotal,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  chapters: [],
  failures: []
};

const completed = new Map((state.chapters || []).map(c => [c.order, c]));

for (const ch of source) {
  if (completed.has(ch.order) && words(completed.get(ch.order).content) >= Math.max(1200, Math.floor(words(ch.content)*1.15))) {
    console.log(`Skipping completed chapter ${ch.order+1}: ${ch.title}`);
    continue;
  }

  const sourceWords = words(ch.content);
  const target = Math.max(sourceWords + 500, Math.round(sourceWords * scale));
  console.log(`Humanising chapter ${ch.order+1}: ${ch.title} (${sourceWords} -> ~${target} words)`);

  const prompt = `You are the senior editor of a British Everyman-style nonfiction health guide. Rewrite the COMPLETE chapter below for ordinary readers while preserving its strongest evidence and useful content.\n\nAUDIENCE\n- people who use or have used chemsex\n- partners, parents, friends and family\n- survivors of coercion, assault, exploitation or difficult sessions\n- clinicians and support workers who want language they can actually use with people\n\nVOICE AND PURPOSE\n- British English, warm, plain-spoken, humane and non-judgemental\n- never moralise about sex, sexuality, HIV status, drug use, relapse or recovery\n- explain technical terms immediately in ordinary language\n- treat the reader as an adult with agency\n- include realistic composite mini-stories and family/partner perspectives where useful, clearly labelled as composite examples rather than real cases\n- make recovery and harm-reduction routes practical, hopeful and credible without pretending there is one correct route\n\nSAFETY AND EVIDENCE\n- preserve or improve genuine visible author-date citations for consequential health claims\n- do not invent studies, statistics, services, quotations, phone numbers or references\n- where exact dosage, taper, timing, physiological threshold or treatment instruction is not robustly sourced and appropriate for a public guide, generalise it and direct the reader to clinical advice instead\n- do not present naloxone as a treatment for non-opioid toxicity; mention it only where opioid exposure is relevant\n- distinguish clearly between emergency warning signs, general harm reduction and medically supervised treatment\n- remove production placeholders, dummy contacts and unsupported pseudo-precision\n\nSTRUCTURE\n- retain a clear chapter title and useful headings\n- add short 'In plain English', 'For family and friends', 'If this is happening to you', 'What helps', or 'When to get urgent help' boxes where genuinely useful\n- add 2-4 purposeful ILLUSTRATION BRIEFS in square brackets, each describing a simple, inclusive, non-stigmatising visual (diagram, decision tree, body map, timeline, or everyday scene). These are production instructions, not factual claims. Avoid decorative filler.\n- use tables sparingly and only when they make comparison easier\n- end with a concise 'What to remember' section\n- avoid sounding like an academic paper or policy document\n\nLENGTH\nAim for roughly ${target} words. Expand through explanation, examples, context and practical guidance, NOT repetition or padding.\n\nRETURN ONLY THE COMPLETE REWRITTEN CHAPTER.\n\nSOURCE CHAPTER:\n${ch.content.slice(0,90000)}`;

  try {
    let content = await ai(prompt, 18000);
    if (words(content) < Math.max(sourceWords, Math.floor(target*0.72))) {
      content = await ai(`Expand the COMPLETE chapter below to about ${target} words without padding. Preserve all existing useful material, improve plain-English explanations, add practical survivor/family perspectives, and keep the same safety/evidence rules. Return only the complete expanded chapter.\n\n${content.slice(0,100000)}`, 18000);
    }
    const record = { order: ch.order, title: ch.title, content, wordCount: words(content), updatedAt: new Date().toISOString() };
    state.chapters = (state.chapters || []).filter(c => c.order !== ch.order).concat(record).sort((a,b)=>a.order-b.order);
    state.updatedAt = new Date().toISOString();
    state.stage = `chapter-${ch.order+1}-complete`;
    atomicWrite(STATE, state);
    console.log(`Persisted chapter ${ch.order+1} (${record.wordCount} words)`);
  } catch (e) {
    console.error(`Chapter ${ch.order+1} failed after bounded retries: ${e.message}`);
    state.failures = (state.failures || []).concat({order:ch.order,title:ch.title,error:e.message,at:new Date().toISOString()});
    // Preserve the source chapter so a provider failure can never destroy the book.
    if (!completed.has(ch.order)) state.chapters = (state.chapters || []).concat({order:ch.order,title:ch.title,content:ch.content,wordCount:sourceWords,preservedSource:true,updatedAt:new Date().toISOString()}).sort((a,b)=>a.order-b.order);
    state.updatedAt = new Date().toISOString();
    state.stage = `chapter-${ch.order+1}-preserved-after-failure`;
    atomicWrite(STATE, state);
  }
}

// Second bounded pass: only expand the shortest chapters until the manuscript approaches target.
let total = (state.chapters || []).reduce((n,c)=>n+words(c.content),0);
if (total < TARGET_WORDS * 0.94) {
  const candidates = state.chapters.slice().sort((a,b)=>words(a.content)-words(b.content));
  for (const c of candidates) {
    if (total >= TARGET_WORDS * 0.98) break;
    const need = TARGET_WORDS - total;
    const extra = Math.min(2200, Math.max(700, Math.ceil(need / Math.max(1, candidates.length/2))));
    try {
      const expanded = await ai(`Expand the COMPLETE chapter below by roughly ${extra} useful words. Add only genuinely helpful plain-English explanation, composite lived-experience examples, family/partner guidance, practical decision aids, and purposeful illustration briefs. Do not pad, duplicate material, invent sources, or add unsupported medical precision. Keep British English, humane and non-judgemental. Return only the full revised chapter.\n\n${c.content.slice(0,100000)}`, 18000);
      const before = words(c.content);
      c.content = expanded;
      c.wordCount = words(expanded);
      c.updatedAt = new Date().toISOString();
      total += c.wordCount - before;
      state.updatedAt = new Date().toISOString();
      state.stage = `expansion-pass-chapter-${c.order+1}`;
      atomicWrite(STATE, state);
    } catch (e) {
      state.failures = (state.failures || []).concat({order:c.order,title:c.title,error:`expansion: ${e.message}`,at:new Date().toISOString()});
      atomicWrite(STATE, state);
    }
  }
}

const finalChapters = state.chapters.slice().sort((a,b)=>a.order-b.order);
const manuscript = finalChapters.map(c => `# ${c.title}\n\n${c.content}`).join('\n\n---\n\n');
atomicWrite(OUT, manuscript);
state.finalWords = words(manuscript);
state.completedAt = new Date().toISOString();
state.stage = 'exported';
state.output = OUT;
atomicWrite(STATE, state);
console.log(`EVERYMAN_EXPORT ${OUT} ${state.finalWords} words failures=${(state.failures||[]).length}`);

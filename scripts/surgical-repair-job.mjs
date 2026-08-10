import fs from 'node:fs';

const JOB_ID = process.env.CASPA_REPAIR_JOB_ID || '5afbd817-fee6-46cd-aa26-2274bee58052';
const JOBS = process.env.CASPA_JOBS_FILE || '/root/Caspa/data/caspa-jobs.json';
const PORT = Number(process.env.PORT || 3000);
const TARGET_ORDERS = new Set([0, 6, 12, 14]);

const productionRx = /\[CITATION NEEDED\]|replace with local|replace later|placeholder|0800\s*123\s*4567|1[-\s]?800[-\s]?555[-\s]?0199/i;
const specificityRx = /\b(?:dose|dosage|taper|reduce by|mg|ml|milligrams?|millilitres?)\b/i;
const authorDateRx = /\([A-Z][A-Za-z-]+(?: et al\.)?,?\s*\d{4}[a-z]?\)/;

function words(s='') { return s.trim().split(/\s+/).filter(Boolean).length; }

async function ai(prompt) {
  const r = await fetch(`http://127.0.0.1:${PORT}/api/ai/call`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      prompt,
      maxTokens: 14000,
      intelligenceMode: 'balanced',
      taskHint: 'factual',
      useWebSearch: true,
      skipLocalFallback: true,
    }),
    signal: AbortSignal.timeout(240000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.result) throw new Error(j.message || `AI call failed ${r.status}`);
  return String(j.result).trim();
}

function issuesFor(order, text) {
  const out = [];
  if (productionRx.test(text)) out.push('production-marker');
  if (order === 12 && specificityRx.test(text) && !authorDateRx.test(text)) out.push('unsafe-specificity');
  return out;
}

function conservativeStrip(text) {
  const blocks = text.split(/\n{2,}/);
  return blocks.filter(b => !productionRx.test(b)).join('\n\n').trim();
}

async function repairChapter(chapter) {
  let current = String(chapter.content || '');
  for (let attempt = 1; attempt <= 3; attempt++) {
    const issues = issuesFor(chapter.order, current);
    if (!issues.length) return current;
    const prompt = `You are performing a surgical publication-safety repair on one chapter of a UK nonfiction guide about chemsex. Return the COMPLETE repaired chapter only.\n\nCHAPTER ${chapter.order + 1}: ${chapter.title}\nCURRENT WORDS: ${words(current)}\nFAILURES TO CLEAR: ${issues.join(', ')}\n\nMANDATORY RULES:\n- Preserve useful unique substance and the chapter's structure.\n- Remove every literal [CITATION NEEDED], dummy contact number, production note, 'replace later/local' instruction, and any use of the word 'placeholder'.\n- Never invent a source, service, number, study, statistic or quotation. If a claim cannot be verified, delete or generalise it.\n- For precise health/drug claims, verify with trustworthy current sources and use genuine Harvard author-date attribution in the prose, e.g. (Surname 2024), with enough bibliographic detail for a reference list.\n- If a precise dose/taper/threshold is not appropriate or cannot be robustly sourced for a public guide, REMOVE the precision rather than guessing.\n- Never imply naloxone treats GHB/GBL, stimulant, ketamine or other non-opioid toxicity; mention it only where opioid exposure is genuinely relevant.\n- Keep the tone accessible, humane, sex-positive and non-judgemental.\n- Do not invent case outcomes or make fictional vignettes look like evidence.\n- Keep purposeful figure/table/box briefs where they add teaching value.\n\nCURRENT CHAPTER:\n${current.slice(0, 70000)}`;
    current = await ai(prompt);
  }
  if (productionRx.test(current)) current = conservativeStrip(current);
  if (chapter.order === 12 && specificityRx.test(current) && !authorDateRx.test(current)) {
    current = await ai(`Return the COMPLETE chapter below after one final safety edit. Remove ALL exact dose, dosage, taper, mg/ml, milligram/millilitre and numerical treatment guidance that is not directly supported by genuine visible Harvard author-date citations. Do not fabricate citations. Generalise the wording where necessary. Preserve the rest.\n\n${current.slice(0,70000)}`);
  }
  return current;
}

const store = JSON.parse(fs.readFileSync(JOBS, 'utf8'));
const jobs = Array.isArray(store) ? store : store.jobs;
if (!Array.isArray(jobs)) throw new Error('Unexpected caspa-jobs.json shape');
const job = jobs.find(j => j.id === JOB_ID);
if (!job) throw new Error(`Job ${JOB_ID} not found`);
const chapters = job.checkpoint?.chapters;
if (!Array.isArray(chapters) || !chapters.length) throw new Error('Retained checkpoint chapters not found');

for (const order of TARGET_ORDERS) {
  const ch = chapters.find(c => c.order === order);
  if (!ch) throw new Error(`Chapter order ${order} missing`);
  console.log(`Repairing chapter ${order + 1}: ${ch.title}`);
  const repaired = await repairChapter(ch);
  const remaining = issuesFor(order, repaired);
  if (remaining.length) throw new Error(`Chapter ${order + 1} still fails: ${remaining.join(', ')}`);
  ch.content = repaired;
  ch.wordCount = words(repaired);
  ch.updatedAt = Date.now();
  console.log(`Chapter ${order + 1} cleared (${ch.wordCount} words)`);
}

job.checkpoint.chapters = chapters;
job.checkpoint.phase = 'surgical-qa-repair';
job.status = 'failed';
job.stage = `surgical-repair-ready:${chapters.reduce((n,c)=>n+words(c.content),0)}-words`;
job.error = 'Surgical repair completed; ready for final QA retry.';
job.updatedAt = new Date().toISOString();

const tmp = `${JOBS}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
fs.renameSync(tmp, JOBS);
console.log(`Checkpoint updated for ${JOB_ID}`);

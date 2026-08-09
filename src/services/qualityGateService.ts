/**
 * Quality gate heuristics for Caspa.
 * Structural integrity and AI-nonsense checks outrank prose polish.
 */

import type { QualityGateFinding, QualityGateStatus, NovelWriteProMode } from '../types/gold';

const FILLER_PATTERNS = [
  /\bvery\b/gi,
  /\breally\b/gi,
  /\bquite\b/gi,
  /\bsuddenly\b/gi,
  /\bseemed to\b/gi,
  /\bfelt like\b/gi,
  /\ba sense of\b/gi,
  /\bin that moment\b/gi,
];

const AI_FOG_PATTERNS = [
  /\bin today's (?:fast[- ]paced|ever[- ]changing) world\b/gi,
  /\bit is important to (?:note|remember|understand) that\b/gi,
  /\bit's important to (?:note|remember|understand) that\b/gi,
  /\bdelve(?:s|d|ing)? into\b/gi,
  /\btapestry of\b/gi,
  /\btestament to\b/gi,
  /\bserves as a reminder\b/gi,
  /\bprofound(?:ly)?\b/gi,
  /\bultimately,? (?:this|the)\b/gi,
  /\bjourney of (?:self[- ]discovery|discovery|transformation)\b/gi,
  /\bnavigate(?:s|d|ing)? the complexities\b/gi,
  /\bcomplex interplay\b/gi,
  /\bmultifaceted\b/gi,
  /\bnuanced understanding\b/gi,
];

const PASSIVE_HINT = /\b(was|were|is|are|been|being)\s+\w+ed\b/gi;
const FAKE_CITATION_HINT = /\((?:[A-Z][A-Za-z'’-]+(?:\s+(?:et al\.|&\s+[A-Z][A-Za-z'’-]+))?),\s*(?:19|20)\d{2}[a-z]?\)/g;
const PLACEHOLDER_HINT = /\b(?:TBD|TK|TODO|INSERT (?:SOURCE|CITATION|FIGURE)|SOURCE NEEDED|CITATION NEEDED)\b/gi;

function scoreToStatus(score: number): QualityGateStatus {
  if (score >= 75) return 'pass';
  if (score >= 50) return 'warn';
  return 'fail';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function repeatedSentenceStarts(sentences: string[]): number {
  const counts = new Map<string, number>();
  for (const raw of sentences) {
    const key = raw.trim().toLowerCase().split(/\s+/).slice(0, 4).join(' ');
    if (key.split(' ').length < 3) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.values()].filter((n) => n >= 3).reduce((sum, n) => sum + (n - 2), 0);
}

export function runQualityGates(content: string, mode: NovelWriteProMode = 'novel'): QualityGateFinding[] {
  const words = content.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const dialogueLines = (content.match(/^["“]/gm) || []).length;
  const findings: QualityGateFinding[] = [];
  const nonfiction = mode === 'nonfiction' || mode === 'essay';

  // 0. AI nonsense / integrity gate — deliberately first.
  let fogHits = 0;
  for (const pattern of AI_FOG_PATTERNS) fogHits += (content.match(pattern) || []).length;
  const repeatedStarts = repeatedSentenceStarts(sentences);
  const placeholders = (content.match(PLACEHOLDER_HINT) || []).length;
  const nonsensePenalty = fogHits * 7 + repeatedStarts * 8 + placeholders * 15;
  const nonsenseScore = clamp(100 - nonsensePenalty, 0, 100);
  const nonsenseIssues: string[] = [];
  if (fogHits) nonsenseIssues.push(`${fogHits} AI-fog / stock-phrase hit${fogHits === 1 ? '' : 's'} detected.`);
  if (repeatedStarts) nonsenseIssues.push('Repeated sentence openings suggest templated or looping prose.');
  if (placeholders) nonsenseIssues.push(`${placeholders} unresolved placeholder${placeholders === 1 ? '' : 's'} remain.`);
  findings.push({
    gate: 'AI nonsense & integrity',
    status: scoreToStatus(nonsenseScore),
    score: Math.round(nonsenseScore),
    issues: nonsenseIssues,
  });

  // Non-fiction provenance gate: citations are not automatically trusted simply because they look scholarly.
  if (nonfiction) {
    const apparentCitations = (content.match(FAKE_CITATION_HINT) || []).length;
    const explicitSourceMarkers = (content.match(/\b(?:doi:|https?:\/\/|ISBN|References|Bibliography|Source:|Sources:)\b/gi) || []).length;
    let provenanceScore = 90;
    const provenanceIssues: string[] = [];
    if (apparentCitations > 0 && explicitSourceMarkers === 0) {
      provenanceScore = 45;
      provenanceIssues.push('Author–date citations appear without visible source provenance. Verify them; never invent a citation.');
    }
    if (placeholders > 0) {
      provenanceScore = Math.min(provenanceScore, 55);
      provenanceIssues.push('Unresolved source/citation placeholders remain.');
    }
    findings.push({
      gate: 'Evidence & provenance',
      status: scoreToStatus(provenanceScore),
      score: provenanceScore,
      issues: provenanceIssues,
    });
  }

  // Length gate
  const minWords = mode === 'script' ? 80 : 120;
  const lengthScore = wordCount >= minWords ? clamp(60 + wordCount / 40, 60, 100) : clamp(wordCount / minWords * 50, 0, 49);
  findings.push({
    gate: 'Length & substance',
    status: scoreToStatus(lengthScore),
    score: Math.round(lengthScore),
    issues: wordCount < minWords ? [`Only ${wordCount} words — expand substance rather than padding.`] : [],
  });

  // Filler gate
  let fillerHits = 0;
  for (const pattern of FILLER_PATTERNS) fillerHits += (content.match(pattern) || []).length;
  const fillerRatio = wordCount ? fillerHits / wordCount : 0;
  const fillerScore = clamp(100 - fillerRatio * 800, 0, 100);
  findings.push({
    gate: 'Filler & hedge words',
    status: scoreToStatus(fillerScore),
    score: Math.round(fillerScore),
    issues: fillerHits > 3 ? [`${fillerHits} weak hedge/filler hits — cut them.`] : [],
  });

  // Specificity gate
  const abstractHits = (content.match(/\b(feel|feeling|emotion|sadness|anger|fear|love|grief|pain)\b/gi) || []).length;
  const specificityScore = clamp(100 - abstractHits * 4, 20, 100);
  findings.push({
    gate: 'Concrete specificity',
    status: scoreToStatus(specificityScore),
    score: Math.round(specificityScore),
    issues: abstractHits > 5
      ? [nonfiction
          ? 'Too many abstractions — replace with evidence, names, dates, examples, mechanisms and precise limits.'
          : 'Too many emotion labels — show behaviour, consequence and concrete detail instead.']
      : [],
  });

  // Dialogue / rhythm (mode-aware)
  if (mode === 'script' || mode === 'musical') {
    const dialogueScore = dialogueLines >= 3 ? 85 : dialogueLines >= 1 ? 60 : 35;
    findings.push({
      gate: 'Playable dialogue',
      status: scoreToStatus(dialogueScore),
      score: dialogueScore,
      issues: dialogueLines < 2 ? ['Add more speakable lines — stage pieces need audible conflict.'] : [],
    });
  } else {
    const avgSentenceLen = sentences.length ? wordCount / sentences.length : wordCount;
    const rhythmScore = avgSentenceLen > 28 ? 55 : avgSentenceLen < 6 ? 50 : 82;
    findings.push({
      gate: 'Rhythm & pacing',
      status: scoreToStatus(rhythmScore),
      score: rhythmScore,
      issues: avgSentenceLen > 28
        ? ['Sentences run long — vary length for clarity and pressure.']
        : avgSentenceLen < 6
          ? ['Too many staccato fragments — vary sentence architecture.']
          : [],
    });
  }

  // Passive voice hint
  const passiveHits = (content.match(PASSIVE_HINT) || []).length;
  const passiveScore = clamp(100 - passiveHits * 6, 30, 100);
  findings.push({
    gate: 'Active voice',
    status: scoreToStatus(passiveScore),
    score: Math.round(passiveScore),
    issues: passiveHits > 4 ? [`~${passiveHits} passive constructions detected.`] : [],
  });

  return findings;
}

export function aggregateQuality(findings: QualityGateFinding[]): {
  overallScore: number;
  status: QualityGateStatus;
} {
  if (!findings.length) return { overallScore: 0, status: 'fail' };

  // Integrity gates veto an otherwise pretty average.
  const hardGate = findings.find((f) => f.gate === 'AI nonsense & integrity' && f.status === 'fail')
    || findings.find((f) => f.gate === 'Evidence & provenance' && f.status === 'fail');
  const overallScore = Math.round(findings.reduce((sum, f) => sum + f.score, 0) / findings.length);
  if (hardGate) return { overallScore: Math.min(overallScore, 49), status: 'fail' };

  const hasFail = findings.some((f) => f.status === 'fail');
  const hasWarn = findings.some((f) => f.status === 'warn');
  const status: QualityGateStatus = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';
  return { overallScore, status };
}

const MODE_HINTS: Record<NovelWriteProMode, string> = {
  novel: 'Structure first: held plot, continuity, promises and pay-offs before sentence polish. No AI sludge.',
  nonfiction: 'Evidence-led non-fiction: thesis, claims, evidence, counterargument, references and reader promises before prose decoration.',
  essay: 'Essay/article: argument first; evidence and honest limits before style. No invented citations.',
  poetry: 'Poetry: compression, music, image before explanation; cut decorative fog.',
  script: 'Stage/screen: playable structure, continuity and pay-offs before clever dialogue.',
  musical: 'Musical theatre: dramatic spine, song placement logic and promised reprises/pay-offs before lyric polish.',
  adaptation: 'Faithful adaptation: preserve source structure, promises and continuity before sharpening prose.',
  polish: 'Manuscript polish: never polish around a structural defect; preserve threads and pay-offs.',
  chaos: 'Experimental form may be wild; its internal contract, through-line and promises must still hold.',
};

export function modeHint(mode: NovelWriteProMode): string {
  return MODE_HINTS[mode];
}

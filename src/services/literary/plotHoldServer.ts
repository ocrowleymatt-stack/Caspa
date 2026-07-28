/**
 * Server-side plot hold helpers (stateless prompt builders).
 * Client persists the hold; server enforces it on write.
 */

export interface ServerPlotHold {
  title?: string;
  premise?: string;
  centralWound?: string;
  immediateDesire?: string;
  genre?: string;
  tone?: string;
  prizeTarget?: string;
  openingImage?: string;
  beats?: Array<{ title: string; turn: string; endingImage?: string; status?: string }>;
  characters?: Array<{ name: string; role?: string; wound?: string; desire?: string; mask?: string }>;
  nonNegotiables?: string[];
}

export function buildServerPlotHoldBlock(hold?: ServerPlotHold | null): string {
  if (!hold) return '';
  const hasSubstance = Boolean(hold.premise?.trim() || (hold.beats && hold.beats.length));
  if (!hasSubstance) return '';

  const beats = (hold.beats || [])
    .map((b, i) => `${i + 1}. [${b.status || 'pending'}] ${b.title} — TURN: ${b.turn}${b.endingImage ? ` · IMAGE: ${b.endingImage}` : ''}`)
    .join('\n');

  const cast = (hold.characters || [])
    .map((c) => `- ${c.name}${c.role ? ` (${c.role})` : ''}: wound=${c.wound || '?'}; desire=${c.desire || '?'}`)
    .join('\n');

  return `
PLOT HOLD — OBEY THIS SPINE (do not invent a rival plot)
Title: ${hold.title || '[untitled]'}
Premise: ${hold.premise || ''}
Central wound: ${hold.centralWound || '[infer carefully]'}
Immediate desire: ${hold.immediateDesire || '[infer]'}
Genre: ${hold.genre || ''}
Tone: ${hold.tone || ''}
Prize target: ${hold.prizeTarget || 'literary excellence'}
Opening image: ${hold.openingImage || ''}

BEATS / CHAPTER TURNS
${beats || '[advance cleanly from premise]'}

CHARACTERS
${cast || '[keep consistent once introduced]'}

NON-NEGOTIABLES
${(hold.nonNegotiables || ['Preserve voice', 'Every scene must turn', 'Do not replace the plot']).map((n) => `- ${n}`).join('\n')}

RULES
- Consume this plot silently. Output artefact first, never a re-plan unless asked.
- Advance the next pending beat.
- Do not discard wound, desire, or locked turns.
`.trim();
}

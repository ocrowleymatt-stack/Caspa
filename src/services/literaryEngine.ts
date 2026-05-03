import { Project, ProjectType, ResearchNote } from '../types';

export type SceneMode = 'quiet' | 'conflict' | 'comic' | 'trauma' | 'reflection' | 'default';

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function inferSceneMode(text: string): SceneMode {
  const lower = text.toLowerCase();
  if (/attack|blood|panic|fear|trauma|injur|threat|rape|violence|arrest|custody/.test(lower)) return 'trauma';
  if (/argue|fight|confront|accuse|refuse|demand|shout|pressure|threat/.test(lower)) return 'conflict';
  if (/comic|funny|absurd|ridiculous|camp|joke|farce|wrong roof/.test(lower)) return 'comic';
  if (/memory|remember|reflect|meaning|god|grief|truth|silence|lonely/.test(lower)) return 'reflection';
  if (/quiet|room|window|rain|morning|alone|kitchen|house/.test(lower)) return 'quiet';
  return 'default';
}

function seedToCadence(seed: number) {
  const sentencePatterns = [
    'short-short-long-medium-fragment',
    'medium-long-short-medium',
    'long-observant-short-cut',
    'dialogue-beat-interior-aftershock',
    'image-action-thought-reversal'
  ];
  const sensoryChannels = ['sound', 'touch', 'smell', 'visual detail', 'temperature', 'spatial pressure'];
  const paragraphShapes = ['varied', 'compressed then released', 'broken by dialogue', 'longer observational blocks', 'short pressure beats'];

  return {
    sentencePattern: sentencePatterns[seed % sentencePatterns.length],
    sensoryChannel: sensoryChannels[Math.floor(seed / 3) % sensoryChannels.length],
    paragraphShape: paragraphShapes[Math.floor(seed / 7) % paragraphShapes.length],
    motifLimit: 1 + (seed % 3),
    dialogueRatioHint: ['low', 'medium', 'high'][Math.floor(seed / 11) % 3],
    silenceIntensity: ['low', 'medium', 'high'][Math.floor(seed / 13) % 3],
    disruptionIntensity: ['subtle', 'moderate', 'rare'][Math.floor(seed / 17) % 3]
  };
}

export function buildAuthorVoiceProfile(project?: Partial<Project>, sourceNotes: ResearchNote[] = []): string {
  const sourceMotifs = sourceNotes
    .slice(0, 12)
    .map(note => note.tags || [])
    .flat()
    .filter(Boolean)
    .slice(0, 18);

  return `
AUTHORIAL VOICE ENGINE — ALWAYS ACTIVE:
- Voice register: British, sharp, surreal when justified, forensic when dealing with systems, emotionally restrained but not emotionally thin.
- Core effect: intelligence under pressure; humour as pressure valve; absurdity grounded in real material rather than forced whimsy.
- Prose preference: precise concrete observation, social pressure, contradiction, subtext, strange ordinary objects that gather meaning.
- Humour rule: dry and situational. Jokes must reveal pressure, class, character, fear, or institutional absurdity. No garnish gags.
- Rhythm: controlled literary prose with occasional short declarative blows. Avoid symmetrical AI paragraphs.
- Avoid: American idiom, therapy-speak, movie-trailer lines, generic lyricism, purple metaphor, neat moralising, repeated emotional labels.
- Prefer: British cadence, exact nouns, gesture, silence, domestic absurdity, institutional language turned strange, withheld pain.
- Project title: ${project?.title || 'Untitled'}
- Project type: ${project?.type || 'novel'}
- Genre/tone: ${project?.genre || 'unspecified'} / ${project?.tone || 'restrained'}
- Source-derived motifs to consider but not spam: ${sourceMotifs.length ? sourceMotifs.join(', ') : 'derive from scene context'}
`;
}

export function buildAlwaysOnVarianceEngine(args: {
  project?: Partial<Project>;
  sceneText?: string;
  chapterTitle?: string;
  targetWordDelta?: number;
  seedOverride?: number;
} = {}): string {
  const seedInput = `${args.project?.id || ''}|${args.project?.title || ''}|${args.chapterTitle || ''}|${args.targetWordDelta || 0}|${new Date().getUTCMinutes()}`;
  const seed = args.seedOverride ?? hashString(seedInput);
  const cadence = seedToCadence(seed);
  const mode = inferSceneMode(`${args.chapterTitle || ''}\n${args.sceneText || ''}`);

  const contextualRules: Record<SceneMode, string> = {
    quiet: 'Quiet scene: slower pace; high observation; lower dialogue; pressure should live in objects, weather, silence, and what is not said.',
    conflict: 'Conflict scene: variable pace; sharper dialogue; short pressure beats mixed with longer interior aftershocks; avoid shouting-as-substitute-for-tension.',
    comic: 'Comic scene: snap rhythm; set-up and reversal; dry undercut; keep restraint high so the comedy lands without begging.',
    trauma: 'Trauma scene: controlled cadence; oblique interiority; fragmentation allowed; no melodrama, no thriller panic, no therapy-summary explanation.',
    reflection: 'Reflective scene: measured pace; layered clarity; motifs may recur but must shift meaning; avoid essaying unless the voice earns it.',
    default: 'Default scene: vary rhythm according to dramatic pressure; keep the prose alive without random quirk.'
  };

  return `
ALWAYS-ON CONTEXTUAL VARIANCE ENGINE:
Purpose: prevent repetitive cadence and improve organic literary texture. This is for prose quality, not deception.
Seed: ${seed}
Detected scene mode: ${mode}
Cadence controls:
- sentence pattern bias: ${cadence.sentencePattern}
- paragraph shape bias: ${cadence.paragraphShape}
- sensory emphasis: ${cadence.sensoryChannel}
- motif recurrence limit before transformation: ${cadence.motifLimit}
- dialogue density hint: ${cadence.dialogueRatioHint}
- silence intensity: ${cadence.silenceIntensity}
- micro-disruption intensity: ${cadence.disruptionIntensity}
Contextual nuance: ${contextualRules[mode]}
Standing rules:
- Vary sentence length, paragraph shape, scene openings, syntax, sensory emphasis, interiority, and dialogue density.
- Preserve meaning, plot continuity, authorial voice, emotional logic, and scene pressure.
- Do not randomise facts. Do not add padding. Do not force quirkiness. Do not break voice.
- If expanding word count, expand through scene action, dialogue tension, interior contradiction, setting pressure, and motif transformation.
`;
}

export function buildLiteraryHostageEngine(): string {
  return `
LITERARY HOSTAGE ENGINE:
Carry unresolved depth-drivers through the scene/chapter:
- thematic hostage: one unresolved idea should remain alive, not neatly solved.
- character hostage: at least one want/behaviour contradiction should sharpen.
- environmental hostage: setting should exert pressure, not sit as wallpaper.
- motif hostage: a recurring image/object may return only if it changes meaning.
Use hostages to create earned expansion. Padding is forbidden.
`;
}

export function buildBackFromTheDeadPass(): string {
  return `
BACK FROM THE DEAD PASS:
Find inert prose: summary, exposition dumps, flat dialogue, generic emotion.
Revive it by converting into live scene material:
- action in real time
- dialogue with evasion or pressure
- interior contradiction
- sensory environment
- social or psychological stakes
Do not merely decorate sentences. Make dead sections do narrative work.
`;
}

export function buildWildcardModules(): string {
  return `
WILDCARD LITERARY MODULES — CONTEXTUAL, NOT CHAOTIC:
1. Silence Engine:
   - Omit obvious emotional conclusions.
   - Let some dialogue go unanswered.
   - End some scenes half a beat early where pressure improves.
2. Micro-Disruption Layer:
   - Use rare fragments, interruptions, or off-beat observations only when they reveal pressure.
   - Do not become quirky for its own sake.
3. Character Drift Engine:
   - POV and dialogue cadence should shift subtly by character: controlled, clipped, associative, evasive, camp, formal, or fractured as appropriate.
4. Motif Mutation Engine:
   - Motifs may recur only if they mutate: object -> pressure -> memory -> threat -> evidence -> joke -> wound.
5. Time Distortion Engine:
   - Expand small emotionally loaded moments; compress logistics and connective tissue.
6. Contradiction Injector:
   - Every major scene should contain one mismatch: said vs meant, wanted vs done, believed vs feared.
7. Memory Leak Engine:
   - Allow brief sensory-triggered memories. No full flashbacks unless explicitly requested.
8. Anti-Symmetry Rule:
   - No two consecutive paragraphs should use the same opening pattern, length profile, or rhetorical structure.
`;
}

export function buildAlwaysOnLiteraryInjection(args: {
  project?: Partial<Project>;
  projectType?: ProjectType;
  research?: ResearchNote[];
  sceneText?: string;
  chapterTitle?: string;
  targetWordDelta?: number;
} = {}): string {
  return `
${buildAuthorVoiceProfile(args.project || { type: args.projectType }, args.research || [])}
${buildLiteraryHostageEngine()}
${buildBackFromTheDeadPass()}
${buildWildcardModules()}
${buildAlwaysOnVarianceEngine(args)}
FINAL QUALITY GATE:
- Apply literary filters: remove cliché, reduce adrenaline, enforce subtext, increase specificity, strip explanation, sharpen rhythm.
- Output should feel authored, British, precise, alive, and contextually varied.
- No meta-commentary in creative output.
`;
}

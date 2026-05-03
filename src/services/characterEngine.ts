import { Character, Chapter } from '../types';

type CharacterProfile = {
  name: string;
  role?: string;
  drive: string;
  fear: string;
  contradiction: string;
  speech: string;
  behaviour: string[];
  pressureResponse: string;
};

const STOP_NAMES = new Set([
  'The', 'And', 'But', 'With', 'That', 'This', 'There', 'Then', 'When', 'Where', 'What', 'They', 'Them', 'Their',
  'Chapter', 'Scene', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
]);

function inferSpeechPattern(name: string, text: string): string {
  const lower = text.toLowerCase();
  if (/(sir|madam|therefore|accordingly|pursuant|formal|officer|court|counsel)/.test(lower)) return 'formal, precise, controlled';
  if (/(joke|laugh|camp|ridiculous|absurd|darling|bloody)/.test(lower)) return 'dry, comic, evasive under pressure';
  if (/(panic|shout|shouting|screamed|frantic|chaos|spiral)/.test(lower)) return 'fractured, reactive, pressure-led';
  if (/(quiet|silent|watched|waited|looked|observed)/.test(lower)) return 'measured, observant, withholding';
  return `${name} must have a distinct cadence inferred from action and pressure, not generic dialogue`;
}

function inferDrive(text: string): string {
  const lower = text.toLowerCase();
  if (/(truth|prove|evidence|record|court|police|report|justice)/.test(lower)) return 'to force truth into an accountable record';
  if (/(escape|leave|get away|survive|safe|safety)/.test(lower)) return 'to survive while preserving autonomy';
  if (/(love|want|need|alone|belong|home)/.test(lower)) return 'to be seen without surrendering control';
  return 'infer from what the character repeatedly does under pressure';
}

function inferFear(text: string): string {
  const lower = text.toLowerCase();
  if (/(exposed|caught|record|watched|seen|known)/.test(lower)) return 'exposure and loss of control';
  if (/(abandoned|alone|left|forgotten)/.test(lower)) return 'being abandoned or made irrelevant';
  if (/(authority|police|court|custody|institution)/.test(lower)) return 'institutional power arriving without explanation';
  return 'infer from avoidance, silence, and disproportionate reactions';
}

function inferContradiction(text: string): string {
  const lower = text.toLowerCase();
  if (/(truth|honest|evidence)/.test(lower) && /(hide|avoid|lie|withheld|silence)/.test(lower)) return 'wants truth but survives by withholding parts of it';
  if (/(control|order|plan)/.test(lower) && /(chaos|panic|mess|collapse)/.test(lower)) return 'needs control but is drawn to chaos';
  if (/(safe|safety|home)/.test(lower) && /(danger|threat|risk)/.test(lower)) return 'seeks safety in places that keep becoming unsafe';
  return 'must contain a want/behaviour mismatch in every substantial scene';
}

function extractNamedProfiles(chapters: Chapter[] = [], explicitCharacters: Character[] = []): CharacterProfile[] {
  const manuscript = chapters.map(c => `${c.title}\n${c.summary}\n${c.content || ''}`).join('\n\n').slice(0, 80000);
  const explicit = explicitCharacters.slice(0, 20).map(c => {
    const body = `${c.name}\n${c.role}\n${c.backstory}\n${(c.traits || []).join(' ')}\n${(c.goals || []).join(' ')}\n${(c.fears || []).join(' ')}\n${(c.motivations || []).join(' ')}`;
    return {
      name: c.name,
      role: c.role,
      drive: (c.goals || [])[0] || inferDrive(body),
      fear: (c.fears || [])[0] || inferFear(body),
      contradiction: inferContradiction(body),
      speech: inferSpeechPattern(c.name, body),
      behaviour: [...(c.traits || []), ...(c.quirks || [])].slice(0, 6),
      pressureResponse: 'behaviour must intensify or distort under pressure without emotional reset'
    };
  });

  const names = Array.from(new Set((manuscript.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b/g) || [])
    .map(n => n.trim())
    .filter(n => !STOP_NAMES.has(n.split(' ')[0]))
    .filter(n => n.length <= 40)))
    .slice(0, 12)
    .filter(n => !explicit.some(e => e.name === n));

  const inferred = names.map(name => {
    const rx = new RegExp(`.{0,350}\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b.{0,350}`, 'gi');
    const nearby = (manuscript.match(rx) || []).join('\n').slice(0, 6000);
    return {
      name,
      drive: inferDrive(nearby),
      fear: inferFear(nearby),
      contradiction: inferContradiction(nearby),
      speech: inferSpeechPattern(name, nearby),
      behaviour: [],
      pressureResponse: 'infer from prior action; if changing behaviour, show pressure or consequence'
    };
  });

  return [...explicit, ...inferred].slice(0, 18);
}

export function buildCharacterPsychologyInjection(args: {
  chapters?: Chapter[];
  characters?: Character[];
  sceneText?: string;
} = {}) {
  const profiles = extractNamedProfiles(args.chapters || [], args.characters || []);
  const scene = args.sceneText || '';

  if (!profiles.length) {
    return `
CHARACTER PSYCHOLOGY ENGINE:
No stable character profiles detected yet.
Rules:
- Infer character psychology from behaviour, not labels.
- No two characters should share the same dialogue cadence.
- Every substantial scene must contain contradiction, evasion, silence, or pressure.
- Dialogue must create tension, not merely exchange information.
`;
  }

  return `
CHARACTER PSYCHOLOGY ENGINE — ALWAYS ACTIVE:
Detected/known character profiles:
${profiles.map(p => `
- ${p.name}${p.role ? ` (${p.role})` : ''}
  drive: ${p.drive}
  fear: ${p.fear}
  contradiction: ${p.contradiction}
  speech cadence: ${p.speech}
  behaviour anchors: ${p.behaviour.length ? p.behaviour.join(', ') : 'infer from prior action'}
  pressure response: ${p.pressureResponse}`).join('\n')}

Current scene pressure sample:
${scene.slice(0, 1800)}

Non-negotiable character rules:
- No emotional reset between chapters.
- No random personality shifts. If behaviour changes, justify it through pressure, contradiction, or consequence.
- Dialogue must reflect power, avoidance, class, fear, intimacy, and withheld information.
- Each speaking character must have a distinct cadence, syntax, and evasive strategy.
- Characters affect each other: one person's chaos should distort another person's control; one person's silence should pressure another person's speech.
- Every major character must contain a live contradiction: wanted vs done, said vs meant, believed vs feared.
- Do not use dialogue to explain plot. Use dialogue to create friction.
- Preserve continuity of previous injuries, secrets, accusations, allegiances, shame, desire, fear, and social status.
`;
}

export function buildCharacterEvolutionInjection(args: {
  chapters?: Chapter[];
  characters?: Character[];
} = {}) {
  const profiles = extractNamedProfiles(args.chapters || [], args.characters || []);
  return `
CHARACTER EVOLUTION ENGINE:
${profiles.length ? profiles.map((p, i) => `- ${p.name}: current arc pressure ${i + 1}. Their contradiction must evolve, not repeat.`).join('\n') : '- No named arcs yet. Build arcs from repeated behaviour.'}
Evolution rules:
- A character may not repeat the same avoidance strategy without cost or mutation.
- Beliefs should shift under evidence, humiliation, desire, violence, love, or institutional pressure.
- Trauma and revelation accumulate. They do not vanish between chapters.
- If a character becomes braver, crueller, quieter, funnier, or stranger, show the cause.
- Track long-form drift: belief -> behaviour -> consequence -> altered belief.
- Arc movement can be subtle, but it must exist.
`;
}

type OrganicStimulus = {
  source: string;
  observation: string;
  craftUse: string;
};

let cache: { at: number; block: string } | null = null;
const CACHE_MS = 20 * 60 * 1000;

const SEA_POINTS = [
  { name: 'Viking', lat: 59.3, lon: 1.5 },
  { name: 'Forties', lat: 57.0, lon: 1.0 },
  { name: 'Dogger', lat: 55.1, lon: 2.0 },
  { name: 'Fisher', lat: 56.2, lon: 5.0 },
  { name: 'Sole', lat: 49.0, lon: -7.0 },
  { name: 'Fastnet', lat: 50.0, lon: -9.0 },
  { name: 'Rockall', lat: 57.0, lon: -13.0 },
  { name: 'Hebrides', lat: 57.3, lon: -7.0 },
  { name: 'Fair Isle', lat: 59.0, lon: -2.0 },
];

function dayIndex() {
  const d = new Date();
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((Date.now() - start) / 86400000);
}

async function marineStimulus(): Promise<OrganicStimulus | null> {
  const point = SEA_POINTS[dayIndex() % SEA_POINTS.length];
  try {
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${point.lat}&longitude=${point.lon}&hourly=wave_height,wave_direction,wave_period&forecast_days=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Caspa/1.0 creative-stimulus' }, signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const json: any = await res.json();
    const heights = Array.isArray(json?.hourly?.wave_height) ? json.hourly.wave_height.filter((n: any) => typeof n === 'number') : [];
    const dirs = Array.isArray(json?.hourly?.wave_direction) ? json.hourly.wave_direction.filter((n: any) => typeof n === 'number') : [];
    const periods = Array.isArray(json?.hourly?.wave_period) ? json.hourly.wave_period.filter((n: any) => typeof n === 'number') : [];
    if (!heights.length) return null;
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const h = avg(heights), dir = dirs.length ? avg(dirs) : 0, period = periods.length ? avg(periods) : 0;
    return {
      source: `live marine conditions near ${point.name}`,
      observation: `mean wave height about ${h.toFixed(1)} m, direction about ${Math.round(dir)}°, period about ${period.toFixed(1)} s`,
      craftUse: 'Use only as an oblique sensory/rhythmic pressure if useful: recurrence, interruption, distance, visibility, exposure, drift. Do not force sea imagery into the work.',
    };
  } catch { return null; }
}

async function worldStimulus(): Promise<OrganicStimulus | null> {
  try {
    const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary', {
      headers: { 'User-Agent': 'Caspa/1.0 creative-stimulus' }, signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const title = String(json?.title || '').trim();
    const extract = String(json?.extract || '').replace(/\s+/g, ' ').trim();
    if (!title || !extract) return null;
    return {
      source: `random live encyclopaedic encounter: ${title}`,
      observation: extract.slice(0, 420),
      craftUse: 'Do not copy subject matter merely because it appeared. Ask what unexpected relation, scale, texture, profession, process, object, historical pressure or contradiction this suggests, then use at most one genuinely useful consequence.',
    };
  } catch { return null; }
}

function timeStimulus(): OrganicStimulus {
  const now = new Date();
  return {
    source: 'actual UTC clock and season',
    observation: `${now.toISOString()} · day ${dayIndex()} of the year`,
    craftUse: 'Let real temporal texture influence pacing or attention if it fits: fatigue, waiting, seasonal light, routine, lateness, repetition. Never mention the clock merely to prove the stimulus was used.',
  };
}

export async function buildOrganicStimulusBlock(): Promise<string> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.block;
  const items = [timeStimulus()];
  const [marine, world] = await Promise.all([marineStimulus(), worldStimulus()]);
  if (marine) items.push(marine);
  if (world) items.push(world);

  const block = `ORGANIC CREATIVE STIMULUS — OPTIONAL, NEVER A PLOT COMMAND
These signals come from the changing world rather than a phrase-picker. They exist to disturb habitual model choices, not to create gimmicks.
${items.map((s, i) => `${i + 1}. ${s.source}\n   Observation: ${s.observation}\n   Possible craft use: ${s.craftUse}`).join('\n')}

RULES FOR USE
- Structure, continuity, promises and character truth outrank every stimulus.
- Use none, one, or a transformed trace. Silence is a valid response.
- Never announce or mechanically quote the stimulus.
- Do not imitate a living author or copy recognisable prose. Literary influence means abstract craft choices: omission, compression, duration, focal distance, syntax, scene pressure, image logic, or restraint.
- Do not recur to the same image/metaphor merely because it was vivid once. The point is anti-pattern, not a new pattern.`;
  cache = { at: Date.now(), block };
  return block;
}

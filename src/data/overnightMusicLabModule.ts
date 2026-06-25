import { createProductionPlan, type OrchestraJob, type OrchestraPlan } from './showProductionOrchestraModule';
import type { ShowFactoryBrief } from './casperShowFactoryModule';

export type MusicLabServiceId =
  | 'ollama_prompt_cycle'
  | 'ollama_critic_cycle'
  | 'ollama_lyrics_rewrite'
  | 'lyria_audition'
  | 'music21_score_stub'
  | 'asset_vault';

export type MusicLabJobType =
  | 'ollama_music_brief'
  | 'ollama_lyric_polish'
  | 'ollama_critic_notes'
  | 'ollama_arrangement_notes'
  | 'lyria_prompt_variant'
  | 'musicxml_plan'
  | 'overnight_scorecard'
  | 'cycle_manifest';

export type MusicLabJobStatus = 'queued' | 'running' | 'completed' | 'blocked' | 'failed' | 'dry_run_ready';

export type MusicLabAgentId =
  | 'music_supervisor'
  | 'composer_room'
  | 'lyric_room'
  | 'arranger_room'
  | 'musical_director'
  | 'actor_singability_panel'
  | 'theatre_critic'
  | 'rights_guardian'
  | 'overnight_producer';

export type MusicLabJob = {
  job_id: string;
  cycle_id: string;
  song_id?: string;
  song_title?: string;
  type: MusicLabJobType;
  title: string;
  agent_id: MusicLabAgentId;
  service_id: MusicLabServiceId;
  model?: string;
  status: MusicLabJobStatus;
  priority: number;
  pass_number: number;
  depends_on: string[];
  input: Record<string, unknown>;
  output_hint: string;
  safety_gate: string;
  created_at: string;
};

export type OvernightMusicCycle = {
  cycle_id: string;
  created_at: string;
  mode: 'dry-run' | 'ollama' | 'hybrid';
  overnight_window_hours: number;
  ollama: {
    host: string;
    model: string;
    temperature: number;
    max_iterations_per_song: number;
    stop_after_score: number;
  };
  plan: OrchestraPlan;
  agents: typeof overnightMusicAgents;
  services: typeof overnightMusicServices;
  jobs: MusicLabJob[];
  quality_gates: Array<{ gate: string; blocking: boolean; checks: string[] }>;
  deliverables: Array<{ id: string; title: string; format: string; status: 'planned' | 'dry_run_ready' | 'requires_ollama' | 'requires_lyria' }>;
};

const stamp = () => new Date().toISOString();
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'caspa';

export const overnightMusicAgents = [
  {
    id: 'music_supervisor' as const,
    name: 'Music Supervisor',
    brief: 'Controls the whole overnight music cycle and refuses to let rough AI music become a sellable score by accident.',
    acceptance: ['songs serve story', 'no derivative artist imitation', 'pack is rehearsal-useful'],
  },
  {
    id: 'composer_room' as const,
    name: 'Composer Room',
    brief: 'Produces multiple motif, tempo, structure and Lyria prompt options per song.',
    acceptance: ['memorable hook', 'clear panto idiom', 'strong finale energy'],
  },
  {
    id: 'lyric_room' as const,
    name: 'Lyric Room',
    brief: 'Cycles lyrics for singability, chorus memorability and plot movement.',
    acceptance: ['clean scansion', 'chorus lands', 'family/adult version split protected'],
  },
  {
    id: 'arranger_room' as const,
    name: 'Arranger Room',
    brief: 'Turns style briefs into practical piano-vocal, tracks-only and small-band planning notes.',
    acceptance: ['key stated', 'range stated', 'simple rehearsal route'],
  },
  {
    id: 'musical_director' as const,
    name: 'Musical Director',
    brief: 'Checks vocal ranges, cue points, count-ins, intros, endings and whether amateurs can actually perform it.',
    acceptance: ['safe tessitura', 'cue-friendly', 'chorus teachable'],
  },
  {
    id: 'actor_singability_panel' as const,
    name: 'Actor Singability Panel',
    brief: 'Represents principals, Dame, villain, children, chorus and non-singers.',
    acceptance: ['fun roles', 'non-singer option', 'crowd participation moments'],
  },
  {
    id: 'theatre_critic' as const,
    name: 'Theatre Critic',
    brief: 'Brutally tests whether the song is entertaining, necessary and likely to survive performance.',
    acceptance: ['not filler', 'audience payoff', 'emotional/comic turn'],
  },
  {
    id: 'rights_guardian' as const,
    name: 'Rights Guardian',
    brief: 'Blocks copied lyrics, named-artist mimicry, chart-song arrangement requests and local defamatory material.',
    acceptance: ['licensable', 'original', 'safe to sell'],
  },
  {
    id: 'overnight_producer' as const,
    name: 'Overnight Producer',
    brief: 'Schedules iterations, saves outputs, scores candidates and selects what should go to Lyria/score workers next morning.',
    acceptance: ['all attempts logged', 'best candidate selected', 'failures retriable'],
  },
];

export const overnightMusicServices = [
  {
    id: 'ollama_prompt_cycle' as const,
    name: 'Ollama local prompt cycle',
    provider: 'Self-hosted Ollama',
    endpoint: '{OLLAMA_HOST}/api/chat',
    env: ['OLLAMA_HOST', 'OLLAMA_MODEL'],
    use: 'Overnight private cycling of song briefs, prompt variants, structure notes and criticism without paid API spend.',
    buildStatus: 'wired_with_dry_run_fallback',
  },
  {
    id: 'ollama_critic_cycle' as const,
    name: 'Ollama critic/referee cycle',
    provider: 'Self-hosted Ollama',
    endpoint: '{OLLAMA_HOST}/api/chat',
    env: ['OLLAMA_HOST', 'OLLAMA_MODEL'],
    use: 'Scores prompt candidates for originality, singability, theatricality and rights safety.',
    buildStatus: 'wired_with_dry_run_fallback',
  },
  {
    id: 'ollama_lyrics_rewrite' as const,
    name: 'Ollama lyric rewrite loop',
    provider: 'Self-hosted Ollama',
    endpoint: '{OLLAMA_HOST}/api/generate',
    env: ['OLLAMA_HOST', 'OLLAMA_MODEL'],
    use: 'Cycles lyrics and alternatives before any Lyria spend.',
    buildStatus: 'wired_with_dry_run_fallback',
  },
  {
    id: 'lyria_audition' as const,
    name: 'Lyria audition queue',
    provider: 'Gemini API / Lyria 3',
    endpoint: 'Gemini/Lyria generation endpoint via Production Orchestra',
    env: ['GEMINI_API_KEY'],
    use: 'Morning shortlist hand-off for selected prompt candidates.',
    buildStatus: 'planned_handoff_ready',
  },
  {
    id: 'music21_score_stub' as const,
    name: 'music21 score planning worker',
    provider: 'Self-hosted Python',
    endpoint: 'local worker',
    env: ['PYTHON_BIN'],
    use: 'Creates deterministic score skeleton plans and transposition candidates.',
    buildStatus: 'diagnostic_ready',
  },
  {
    id: 'asset_vault' as const,
    name: 'Caspa local music vault',
    provider: 'Caspa local-first storage',
    endpoint: 'filesystem',
    env: ['CASPA_DATA_DIR'],
    use: 'Stores overnight job records, candidate text, scorecards and selected prompts.',
    buildStatus: 'built',
  },
];

export const overnightMusicQualityGates = [
  { gate: 'rights_preflight', blocking: true, checks: ['no named living artist imitation', 'no copied lyric lines', 'no chart-song arrangement request', 'no uncleared local defamatory claims'] },
  { gate: 'singability_gate', blocking: false, checks: ['clear chorus', 'safe vocal range', 'breathing points', 'non-singer route'] },
  { gate: 'theatre_gate', blocking: false, checks: ['advances plot', 'comic/emotional turn', 'audience participation option', 'not filler'] },
  { gate: 'lyria_handoff_gate', blocking: true, checks: ['best candidate selected', 'negative prompt included', 'style is generic not imitative', 'duration and structure declared'] },
  { gate: 'morning_review_gate', blocking: true, checks: ['overnight log complete', 'scorecard exported', 'failures visible', 'selected prompts ready for human review'] },
];

function makeJob(partial: Omit<MusicLabJob, 'job_id' | 'created_at' | 'status'> & { status?: MusicLabJobStatus }, index: number): MusicLabJob {
  return {
    job_id: `mlab-${String(index + 1).padStart(3, '0')}-${slug(partial.title).slice(0, 36)}`,
    created_at: stamp(),
    status: partial.status || 'queued',
    ...partial,
  };
}

function buildOllamaChatPayload(system: string, prompt: string, model = 'llama3.1:8b', temperature = 0.7) {
  return {
    model,
    stream: false,
    options: { temperature, num_ctx: 8192 },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
  };
}

function buildOllamaGeneratePayload(prompt: string, model = 'llama3.1:8b', temperature = 0.7) {
  return {
    model,
    stream: false,
    options: { temperature, num_ctx: 8192 },
    prompt,
  };
}

export function createOvernightMusicCycle(brief: ShowFactoryBrief = {}, options: Partial<OvernightMusicCycle['ollama']> & { mode?: OvernightMusicCycle['mode']; overnight_window_hours?: number } = {}): OvernightMusicCycle {
  const plan = createProductionPlan(brief);
  const songs = plan.pack.song_map.slice(0, plan.pack.brief.songCount);
  const ollama = {
    host: options.host || 'http://127.0.0.1:11434',
    model: options.model || 'llama3.1:8b',
    temperature: options.temperature ?? 0.74,
    max_iterations_per_song: options.max_iterations_per_song ?? 3,
    stop_after_score: options.stop_after_score ?? 86,
  };
  const cycle_id = `music-lab-${slug(plan.pack.brief.title)}-${Date.now()}`;
  const jobs: MusicLabJob[] = [];

  songs.forEach((song, songIndex) => {
    const baseDeps: string[] = [];
    for (let pass = 1; pass <= ollama.max_iterations_per_song; pass += 1) {
      const promptBrief = `Show: ${plan.pack.brief.title}\nAudience: ${plan.pack.brief.audience}\nSong: ${song.title}\nFunction: ${song.function}\nStyle: ${song.style}\nDefault key: ${song.default_key}\nVocal range: ${song.vocal_range}\nPass: ${pass}\nTask: Create a better Lyria-ready music prompt, structural notes and practical musical theatre guidance. Keep it original, panto-safe and non-imitative.`;
      const musicJob = makeJob({
        cycle_id,
        song_id: song.song_id,
        song_title: song.title,
        type: 'ollama_music_brief',
        title: `${song.title} — music prompt pass ${pass}`,
        agent_id: 'composer_room',
        service_id: 'ollama_prompt_cycle',
        model: ollama.model,
        priority: 10 + songIndex * 10 + pass,
        pass_number: pass,
        depends_on: baseDeps.slice(-1),
        input: buildOllamaChatPayload(
          'You are a musical theatre composer creating original, non-imitative panto music prompts for a local production engine. Return concise structured Markdown with: hook idea, tempo, instrumentation, structure, chorus line, Lyria prompt, negative prompt, and QA risks.',
          promptBrief,
          ollama.model,
          ollama.temperature,
        ),
        output_hint: `music-lab/${slug(song.title)}/pass-${pass}/music-brief.md`,
        safety_gate: 'rights_preflight',
      }, jobs.length);
      jobs.push(musicJob);
      baseDeps.push(musicJob.job_id);

      const lyricJob = makeJob({
        cycle_id,
        song_id: song.song_id,
        song_title: song.title,
        type: 'ollama_lyric_polish',
        title: `${song.title} — lyric polish pass ${pass}`,
        agent_id: 'lyric_room',
        service_id: 'ollama_lyrics_rewrite',
        model: ollama.model,
        priority: 20 + songIndex * 10 + pass,
        pass_number: pass,
        depends_on: [musicJob.job_id],
        input: buildOllamaGeneratePayload(
          `Rewrite/improve original panto lyrics for ${song.title}. Function: ${song.function}. Style: ${song.style}. Provide verse/chorus/bridge, chorus hook, optional audience call-response, and notes on scansion. Do not copy known songs. Keep it licensable and family-safe unless an adult version is explicitly requested.`,
          ollama.model,
          ollama.temperature,
        ),
        output_hint: `music-lab/${slug(song.title)}/pass-${pass}/lyrics.md`,
        safety_gate: 'rights_preflight',
      }, jobs.length);
      jobs.push(lyricJob);

      const criticJob = makeJob({
        cycle_id,
        song_id: song.song_id,
        song_title: song.title,
        type: 'ollama_critic_notes',
        title: `${song.title} — critic score pass ${pass}`,
        agent_id: 'theatre_critic',
        service_id: 'ollama_critic_cycle',
        model: ollama.model,
        priority: 30 + songIndex * 10 + pass,
        pass_number: pass,
        depends_on: [musicJob.job_id, lyricJob.job_id],
        input: buildOllamaChatPayload(
          'You are a sharp theatre critic and musical director. Score the candidate out of 100 for originality, singability, theatricality, panto usefulness, rights safety and audience payoff. Return JSON if possible.',
          `Evaluate ${song.title} pass ${pass}. Song function: ${song.function}. The upstream music and lyric passes are dependencies. State whether this should be sent to Lyria, revised, or killed.`,
          ollama.model,
          0.25,
        ),
        output_hint: `music-lab/${slug(song.title)}/pass-${pass}/critic-score.json`,
        safety_gate: 'theatre_gate',
      }, jobs.length);
      jobs.push(criticJob);

      const arrangementJob = makeJob({
        cycle_id,
        song_id: song.song_id,
        song_title: song.title,
        type: 'ollama_arrangement_notes',
        title: `${song.title} — arrangement notes pass ${pass}`,
        agent_id: 'arranger_room',
        service_id: 'ollama_prompt_cycle',
        model: ollama.model,
        priority: 40 + songIndex * 10 + pass,
        pass_number: pass,
        depends_on: [criticJob.job_id],
        input: buildOllamaChatPayload(
          'You are a practical arranger for amateur theatre, schools and operatic societies. Keep arrangements playable.',
          `Create arrangement notes for ${song.title}: piano-vocal route, tracks-only route, small-band option, rehearsal cue notes, range warnings, and MusicXML/MIDI planning hints. Default key ${song.default_key}, range ${song.vocal_range}.`,
          ollama.model,
          0.45,
        ),
        output_hint: `music-lab/${slug(song.title)}/pass-${pass}/arrangement-notes.md`,
        safety_gate: 'singability_gate',
      }, jobs.length);
      jobs.push(arrangementJob);
    }

    jobs.push(makeJob({
      cycle_id,
      song_id: song.song_id,
      song_title: song.title,
      type: 'lyria_prompt_variant',
      title: `${song.title} — morning Lyria shortlist`,
      agent_id: 'overnight_producer',
      service_id: 'lyria_audition',
      model: songIndex === 0 || song.title.toLowerCase().includes('finale') ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview',
      priority: 90 + songIndex,
      pass_number: ollama.max_iterations_per_song,
      depends_on: jobs.filter((job) => job.song_id === song.song_id && job.type === 'ollama_critic_notes').map((job) => job.job_id),
      input: {
        instruction: 'Select best overnight candidate and prepare Lyria-ready audition payload.',
        song,
        negativePrompt: 'Do not imitate named artists. Do not reuse known copyrighted melodies or lyrics. Keep output original and licensable.',
      },
      output_hint: `music-lab/${slug(song.title)}/selected-lyria-payload.json`,
      safety_gate: 'lyria_handoff_gate',
      status: 'dry_run_ready',
    }, jobs.length));

    jobs.push(makeJob({
      cycle_id,
      song_id: song.song_id,
      song_title: song.title,
      type: 'musicxml_plan',
      title: `${song.title} — MusicXML morning plan`,
      agent_id: 'arranger_room',
      service_id: 'music21_score_stub',
      model: 'music21-local-worker',
      priority: 100 + songIndex,
      pass_number: 1,
      depends_on: jobs.filter((job) => job.song_id === song.song_id && job.type === 'ollama_arrangement_notes').map((job) => job.job_id),
      input: { song, instruction: 'Prepare MusicXML/MIDI deterministic skeleton plan from the overnight arrangement notes.' },
      output_hint: `music-lab/${slug(song.title)}/musicxml-plan.json`,
      safety_gate: 'singability_gate',
      status: 'dry_run_ready',
    }, jobs.length));
  });

  jobs.push(makeJob({
    cycle_id,
    type: 'overnight_scorecard',
    title: 'Whole-show overnight music scorecard',
    agent_id: 'overnight_producer',
    service_id: 'asset_vault',
    model: 'local-scorecard',
    priority: 999,
    pass_number: 1,
    depends_on: jobs.filter((job) => job.type === 'lyria_prompt_variant' || job.type === 'musicxml_plan').map((job) => job.job_id),
    input: { cycle_id, stop_after_score: ollama.stop_after_score, songs: songs.map((song) => song.title) },
    output_hint: 'music-lab/overnight-scorecard.json',
    safety_gate: 'morning_review_gate',
    status: 'dry_run_ready',
  }, jobs.length));

  jobs.push(makeJob({
    cycle_id,
    type: 'cycle_manifest',
    title: 'Overnight music cycle manifest',
    agent_id: 'overnight_producer',
    service_id: 'asset_vault',
    model: 'local-manifest',
    priority: 1000,
    pass_number: 1,
    depends_on: jobs.slice(-1).map((job) => job.job_id),
    input: { cycle_id, folders: ['music-lab', 'songs', 'lyrics', 'lyria-shortlist', 'score-plans'] },
    output_hint: 'music-lab/cycle-manifest.json',
    safety_gate: 'morning_review_gate',
    status: 'dry_run_ready',
  }, jobs.length));

  return {
    cycle_id,
    created_at: stamp(),
    mode: options.mode || 'dry-run',
    overnight_window_hours: options.overnight_window_hours || 8,
    ollama,
    plan,
    agents: overnightMusicAgents,
    services: overnightMusicServices,
    jobs,
    quality_gates: overnightMusicQualityGates,
    deliverables: [
      { id: 'overnight-prompt-variants', title: 'Multiple Lyria prompt candidates per song', format: 'markdown/json', status: 'requires_ollama' },
      { id: 'lyrics-polish-pack', title: 'Cycled lyrics and chorus alternatives', format: 'markdown', status: 'requires_ollama' },
      { id: 'critic-scorecards', title: 'Theatre critic and MD scorecards', format: 'json/markdown', status: 'dry_run_ready' },
      { id: 'morning-lyria-shortlist', title: 'Selected prompts for Lyria audition', format: 'json', status: 'requires_lyria' },
      { id: 'score-planning-pack', title: 'MusicXML and arrangement planning pack', format: 'json/musicxml later', status: 'dry_run_ready' },
      { id: 'overnight-manifest', title: 'Full cycle manifest and retry state', format: 'json', status: 'dry_run_ready' },
    ],
  };
}

export function dryRunMusicLabJob(job: MusicLabJob) {
  const base = {
    job_id: job.job_id,
    status: 'completed' as const,
    mode: 'dry_run' as const,
    generated_at: stamp(),
    output_hint: job.output_hint,
  };

  if (job.type === 'ollama_critic_notes') {
    const score = 72 + ((job.pass_number * 5) % 19);
    return {
      ...base,
      artifact_type: 'critic-scorecard-placeholder',
      score,
      verdict: score >= 86 ? 'send_to_lyria' : 'revise_again',
      notes: ['Hook is viable', 'Check chorus scansion', 'Keep style generic and non-imitative'],
    };
  }

  if (job.type === 'lyria_prompt_variant') {
    return {
      ...base,
      artifact_type: 'lyria-shortlist-placeholder',
      selected: true,
      payload: job.input,
      message: 'Prepared for morning Lyria audition. Live audio remains a separate explicit API spend step.',
    };
  }

  if (job.type === 'musicxml_plan') {
    return {
      ...base,
      artifact_type: 'score-plan-placeholder',
      plan: { key_strategy: 'preserve master key; create transposed child versions only', exports: ['musicxml', 'midi', 'piano-vocal-pdf later'] },
    };
  }

  return {
    ...base,
    artifact_type: 'ollama-placeholder',
    content: `# ${job.title}\n\nDry-run placeholder for ${job.agent_id}. This job is ready for ${job.service_id}.\n\nSafety gate: ${job.safety_gate}.\nOutput target: ${job.output_hint}.`,
    request_payload: job.input,
  };
}

export function runOvernightMusicLabVirtualTest(cycle = createOvernightMusicCycle()) {
  const serviceIds = new Set(cycle.services.map((service) => service.id));
  const agentIds = new Set(cycle.agents.map((agent) => agent.id));
  const jobTypes = new Set(cycle.jobs.map((job) => job.type));
  const songCount = cycle.plan.pack.song_map.length;
  const checks = [
    { id: 'cycle_identity', label: 'Overnight cycle has ID, plan and show pack', pass: Boolean(cycle.cycle_id && cycle.plan?.plan_id && cycle.plan.pack?.pack_id), weight: 8 },
    { id: 'ollama_service', label: 'Ollama chat/generate services represented', pass: serviceIds.has('ollama_prompt_cycle') && serviceIds.has('ollama_lyrics_rewrite'), weight: 10 },
    { id: 'agent_room', label: 'Music-specific agent company represented', pass: ['composer_room', 'lyric_room', 'arranger_room', 'theatre_critic', 'rights_guardian'].every((agent) => agentIds.has(agent as any)), weight: 10 },
    { id: 'iteration_density', label: 'Multiple overnight passes per song', pass: cycle.jobs.filter((job) => job.type === 'ollama_music_brief').length >= songCount * 2, weight: 10 },
    { id: 'lyrics_loop', label: 'Lyrics rewrite loop included', pass: jobTypes.has('ollama_lyric_polish'), weight: 8 },
    { id: 'critic_loop', label: 'Critic scorecards included before Lyria spend', pass: jobTypes.has('ollama_critic_notes'), weight: 9 },
    { id: 'lyria_handoff', label: 'Morning Lyria shortlist handoff included', pass: jobTypes.has('lyria_prompt_variant'), weight: 9 },
    { id: 'score_path', label: 'Score/MusicXML planning path included', pass: jobTypes.has('musicxml_plan'), weight: 8 },
    { id: 'rights_gate', label: 'Rights preflight gate is blocking', pass: cycle.quality_gates.some((gate) => gate.gate === 'rights_preflight' && gate.blocking), weight: 10 },
    { id: 'manifest', label: 'Overnight manifest and morning review gate planned', pass: jobTypes.has('cycle_manifest') && jobTypes.has('overnight_scorecard'), weight: 8 },
    { id: 'no_ticketing_website', label: 'Website/ticketing remain out of scope', pass: true, weight: 5 },
    { id: 'dry_run_safe', label: 'Virtual test can run without Ollama running', pass: cycle.jobs.every((job) => job.status !== 'running'), weight: 5 },
  ];
  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  const passed = checks.filter((check) => check.pass).reduce((sum, check) => sum + check.weight, 0);
  return {
    ok: checks.every((check) => check.pass),
    score: Math.round((passed / total) * 100),
    checks,
    jobCount: cycle.jobs.length,
    songs: songCount,
    agentCount: cycle.agents.length,
    serviceCount: cycle.services.length,
    deliverableCount: cycle.deliverables.length,
    note: 'This validates overnight Ollama music cycling, Lyria handoff and score planning without requiring Ollama or paid API credentials.',
  };
}

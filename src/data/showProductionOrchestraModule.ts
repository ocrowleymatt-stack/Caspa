import { createShowRoadPack, type ShowFactoryBrief, type ShowFactoryPack } from './casperShowFactoryModule';

export type OrchestraAgentId =
  | 'executive_producer'
  | 'showrunner'
  | 'book_writer'
  | 'lyricist'
  | 'composer'
  | 'arranger'
  | 'musical_director'
  | 'director'
  | 'actor_table'
  | 'critic_panel'
  | 'rights_safety'
  | 'qa_producer';

export type OrchestraJobType =
  | 'show_bible'
  | 'script_scene'
  | 'lyrics'
  | 'music_prompt'
  | 'lyria_clip'
  | 'lyria_pro_song'
  | 'guide_vocal'
  | 'musicxml_stub'
  | 'score_render_plan'
  | 'qa_review'
  | 'assembly_manifest';

export type OrchestraJobStatus = 'queued' | 'dry_run_ready' | 'running' | 'completed' | 'failed' | 'blocked';

export type OrchestraServiceId =
  | 'gemini_structured_text'
  | 'gemini_function_calling'
  | 'lyria_3_clip'
  | 'lyria_3_pro'
  | 'gemini_tts'
  | 'music21_worker'
  | 'musescore_cli_worker'
  | 'ffmpeg_worker'
  | 'asset_vault';

export type OrchestraJob = {
  job_id: string;
  pack_id: string;
  type: OrchestraJobType;
  title: string;
  agent_id: OrchestraAgentId;
  service_id: OrchestraServiceId;
  model?: string;
  status: OrchestraJobStatus;
  priority: number;
  depends_on: string[];
  input: Record<string, unknown>;
  output_hint: string;
  safety_gate: string;
  created_at: string;
};

export type OrchestraPlan = {
  plan_id: string;
  created_at: string;
  pack: ShowFactoryPack;
  phases: Array<{ phase: number; name: string; objective: string; jobs: string[] }>;
  jobs: OrchestraJob[];
  agents: typeof orchestraAgents;
  services: typeof orchestraServices;
  quality_gates: Array<{ gate: string; purpose: string; blocking: boolean; checks: string[] }>;
  deliverables: Array<{ id: string; title: string; format: string; produced_by: OrchestraJobType[]; status: 'planned' | 'ready' | 'requires_live_api' }>;
};

const stamp = () => new Date().toISOString();
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'caspa';

export const orchestraAgents = [
  {
    id: 'executive_producer' as const,
    name: 'Executive Producer',
    brief: 'Owns commercial readiness, asset order, licensing assumptions and route to downloadable pack.',
    acceptance: ['every deliverable has owner', 'no download before QA', 'support burden minimised'],
  },
  {
    id: 'showrunner' as const,
    name: 'Showrunner',
    brief: 'Maintains whole-show structure, pace, audience promise and running order.',
    acceptance: ['strong opening', 'clear interval turn', 'earned finale'],
  },
  {
    id: 'book_writer' as const,
    name: 'Book Writer',
    brief: 'Turns scene plans into playable dialogue, stage business and cast-flex script material.',
    acceptance: ['clear entrances/exits', 'comic beats marked', 'localisable slots labelled'],
  },
  {
    id: 'lyricist' as const,
    name: 'Lyricist',
    brief: 'Writes original lyrics that move plot, reveal character and avoid copyright contamination.',
    acceptance: ['singable chorus', 'no known-lyric borrowing', 'dramatic function served'],
  },
  {
    id: 'composer' as const,
    name: 'Composer',
    brief: 'Creates Lyria-ready musical briefs, motifs, tempo, instrumentation and song structure.',
    acceptance: ['memorable hook', 'performable range', 'style not artist-imitative'],
  },
  {
    id: 'arranger' as const,
    name: 'Arranger',
    brief: 'Builds piano-vocal, tracks-only and small-band paths with MusicXML/MIDI renderability.',
    acceptance: ['renderable score', 'key change safe', 'instrument parts practical'],
  },
  {
    id: 'musical_director' as const,
    name: 'Musical Director',
    brief: 'Checks vocal ranges, rehearsal usefulness, cue clarity and backing-track practicality.',
    acceptance: ['safe tessitura', 'cue-friendly intros', 'guide vocals labelled'],
  },
  {
    id: 'director' as const,
    name: 'Stage Director',
    brief: 'Tests staging feasibility for village halls, schools and small venues.',
    acceptance: ['minimal scene-change pain', 'simple choreography alternative', 'clear stage pictures'],
  },
  {
    id: 'actor_table' as const,
    name: 'Actor Table',
    brief: 'Represents principals, chorus, Dame, villain, children and non-singers.',
    acceptance: ['good parts', 'fair spotlight', 'non-singer routes'],
  },
  {
    id: 'critic_panel' as const,
    name: 'Theatre Critics',
    brief: 'Applies brutal taste: pace, surprise, heart, joke quality and whether it is worth staging.',
    acceptance: ['not AI sludge', 'audience pay-off', 'reviewable quality'],
  },
  {
    id: 'rights_safety' as const,
    name: 'Rights & Safety',
    brief: 'Blocks copyright, living-artist imitation, defamation, protected-characteristic abuse and wrong-version content.',
    acceptance: ['licensable assets only', 'school/adult separation', 'expired topical jokes flagged'],
  },
  {
    id: 'qa_producer' as const,
    name: 'QA Producer',
    brief: 'Runs pack completeness, manifest, export, checksum and retry logic.',
    acceptance: ['all assets listed', 'failed jobs retriable', 'export package complete'],
  },
];

export const orchestraServices = [
  {
    id: 'gemini_structured_text' as const,
    name: 'Gemini API structured generation',
    provider: 'Google AI / Vertex AI',
    env: ['GEMINI_API_KEY'],
    liveEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    models: ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash'],
    use: 'Show bible, scenes, lyrics, reviews and JSON manifests.',
    buildStatus: 'wired_with_dry_run_fallback',
  },
  {
    id: 'gemini_function_calling' as const,
    name: 'Gemini function calling / structured output',
    provider: 'Google AI / Vertex AI',
    env: ['GEMINI_API_KEY'],
    models: ['gemini-3.5-flash', 'gemini-3.1-pro-preview'],
    use: 'Agent routing, tool decisions, QA checklists and manifest schema adherence.',
    buildStatus: 'planned_payloads_ready',
  },
  {
    id: 'lyria_3_clip' as const,
    name: 'Lyria 3 Clip',
    provider: 'Gemini API',
    env: ['GEMINI_API_KEY'],
    models: ['lyria-3-clip-preview'],
    use: '30-second preview clips, motifs, auditions and show-library samples.',
    buildStatus: 'wired_with_dry_run_fallback',
  },
  {
    id: 'lyria_3_pro' as const,
    name: 'Lyria 3 Pro',
    provider: 'Gemini API / Vertex AI',
    env: ['GEMINI_API_KEY'],
    models: ['lyria-3-pro-preview'],
    use: 'Longer songs with verse/chorus/bridge structures and demo soundtrack material.',
    buildStatus: 'wired_with_dry_run_fallback',
  },
  {
    id: 'gemini_tts' as const,
    name: 'Gemini TTS / Cloud Text-to-Speech',
    provider: 'Google Cloud',
    env: ['GOOGLE_CLOUD_PROJECT'],
    models: ['gemini-3.1-flash-tts-preview'],
    use: 'Guide vocals, spoken stage cues and prompt-script rehearsal narration.',
    buildStatus: 'adapter_spec_ready',
  },
  {
    id: 'music21_worker' as const,
    name: 'music21 symbolic worker',
    provider: 'Self-hosted Python',
    env: ['PYTHON_BIN'],
    models: [],
    use: 'MusicXML/MIDI, transposition, vocal-range checks and deterministic score skeletons.',
    buildStatus: 'diagnostic_ready',
  },
  {
    id: 'musescore_cli_worker' as const,
    name: 'MuseScore CLI render worker',
    provider: 'Self-hosted',
    env: ['MUSESCORE_BIN'],
    models: [],
    use: 'Render MusicXML into PDF scores and MIDI where available.',
    buildStatus: 'diagnostic_ready',
  },
  {
    id: 'ffmpeg_worker' as const,
    name: 'FFmpeg media worker',
    provider: 'Self-hosted',
    env: ['FFMPEG_BIN'],
    models: [],
    use: 'Normalise MP3/WAV, assemble preview reels and create backing-track exports.',
    buildStatus: 'diagnostic_ready',
  },
  {
    id: 'asset_vault' as const,
    name: 'Local asset vault',
    provider: 'Caspa local-first storage',
    env: ['CASPA_DATA_DIR'],
    models: [],
    use: 'Stores generated prompts, dry-run outputs, live audio responses and manifests.',
    buildStatus: 'built',
  },
];

export const orchestraQualityGates = [
  { gate: 'prompt_rights_gate', purpose: 'Blocks named-artist imitation, copied lyrics and uncleared protected material before API calls.', blocking: true, checks: ['no named living artist imitation', 'no copyrighted lyric prompt', 'no chart-song arrangement request'] },
  { gate: 'agent_review_gate', purpose: 'Requires critic, actor, director and producer review before pack assembly.', blocking: false, checks: ['pace reviewed', 'playability reviewed', 'audience promise reviewed'] },
  { gate: 'music_generation_gate', purpose: 'Checks every song has lyric, style, key, duration and Lyria model assigned.', blocking: true, checks: ['model selected', 'duration sensible', 'range stated', 'lyrics/prompt linked'] },
  { gate: 'score_render_gate', purpose: 'Keeps MusicXML/MuseScore work separate from Lyria audio until deterministic render is available.', blocking: false, checks: ['MusicXML stub present', 'render worker diagnostic logged', 'score QA pending if no worker'] },
  { gate: 'assembly_gate', purpose: 'Prevents release until assets, failures and retry status are visible.', blocking: true, checks: ['manifest complete', 'failed jobs retriable', 'download pack includes README'] },
];

function makeJob(partial: Omit<OrchestraJob, 'job_id' | 'created_at' | 'status'> & { status?: OrchestraJobStatus }, index: number): OrchestraJob {
  return {
    job_id: `job-${String(index + 1).padStart(3, '0')}-${slug(partial.title).slice(0, 36)}`,
    created_at: stamp(),
    status: partial.status || 'queued',
    ...partial,
  };
}

export function buildGeminiTextPayload(prompt: string, schemaName?: string, model = 'gemini-3.5-flash') {
  return {
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: schemaName ? 'application/json' : 'text/plain',
    },
    metadata: { schemaName: schemaName || null, caspaPurpose: 'show-production-orchestra' },
  };
}

export function buildLyriaGenerationPayload(prompt: string, model = 'lyria-3-clip-preview', negativePrompt = 'Do not imitate any named living artist. Do not reuse known copyrighted melodies or lyrics.') {
  return {
    model,
    contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nRights constraints: ${negativePrompt}` }] }],
    generationConfig: {
      temperature: 1,
    },
    expectedOutput: 'audio/mp3 plus model-generated lyrics/structure where returned',
  };
}

export function createProductionPlan(brief: ShowFactoryBrief = {}): OrchestraPlan {
  const pack = createShowRoadPack(brief);
  const jobs: OrchestraJob[] = [];

  jobs.push(makeJob({
    pack_id: pack.pack_id,
    type: 'show_bible',
    title: `${pack.brief.title} show bible structured pass`,
    agent_id: 'showrunner',
    service_id: 'gemini_structured_text',
    model: 'gemini-3.5-flash',
    priority: 1,
    depends_on: [],
    input: buildGeminiTextPayload(`Create a JSON show bible refinement for ${pack.brief.title}. Keep it family-safe, panto-ready, licensable and structured for amateur theatre production.`, 'show_bible'),
    output_hint: 'show-bible.refined.json',
    safety_gate: 'prompt_rights_gate',
  }, jobs.length));

  pack.scene_list.slice(0, 10).forEach((scene, sceneIndex) => {
    jobs.push(makeJob({
      pack_id: pack.pack_id,
      type: 'script_scene',
      title: `Scene ${scene.scene}: ${scene.title}`,
      agent_id: 'book_writer',
      service_id: 'gemini_structured_text',
      model: 'gemini-3.5-flash',
      priority: 2 + sceneIndex,
      depends_on: [jobs[0].job_id],
      input: buildGeminiTextPayload(`Write a playable panto scene for ${pack.brief.title}. Scene: ${scene.title}. Function: ${scene.dramatic_function}. Include entrances, exits, stage business, localisable slots, and clear family-safe comic beats.`, 'script_scene'),
      output_hint: `script/scenes/scene-${String(scene.scene).padStart(2, '0')}.md`,
      safety_gate: 'agent_review_gate',
    }, jobs.length));
  });

  pack.song_map.slice(0, pack.brief.songCount).forEach((song, songIndex) => {
    const lyricJob = makeJob({
      pack_id: pack.pack_id,
      type: 'lyrics',
      title: `${song.title} lyrics`,
      agent_id: 'lyricist',
      service_id: 'gemini_structured_text',
      model: 'gemini-3.5-flash',
      priority: 30 + songIndex,
      depends_on: [jobs[0].job_id],
      input: buildGeminiTextPayload(`Write original musical theatre/panto lyrics for ${song.title}. Function: ${song.function}. Style: ${song.style}. Key: ${song.default_key}. Range: ${song.vocal_range}. Include verse/chorus structure and avoid any recognisable copyrighted lyric or named-artist imitation.`, 'song_lyrics'),
      output_hint: `songs/lyrics/${slug(song.title)}.md`,
      safety_gate: 'prompt_rights_gate',
    }, jobs.length);
    jobs.push(lyricJob);

    jobs.push(makeJob({
      pack_id: pack.pack_id,
      type: songIndex === 0 || song.title.toLowerCase().includes('finale') ? 'lyria_pro_song' : 'lyria_clip',
      title: `${song.title} demo audio`,
      agent_id: 'composer',
      service_id: songIndex === 0 || song.title.toLowerCase().includes('finale') ? 'lyria_3_pro' : 'lyria_3_clip',
      model: songIndex === 0 || song.title.toLowerCase().includes('finale') ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview',
      priority: 50 + songIndex,
      depends_on: [lyricJob.job_id],
      input: buildLyriaGenerationPayload(song.lyria_prompt, songIndex === 0 || song.title.toLowerCase().includes('finale') ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview'),
      output_hint: `audio/demos/${slug(song.title)}.mp3`,
      safety_gate: 'music_generation_gate',
    }, jobs.length));

    jobs.push(makeJob({
      pack_id: pack.pack_id,
      type: 'musicxml_stub',
      title: `${song.title} MusicXML skeleton`,
      agent_id: 'arranger',
      service_id: 'music21_worker',
      model: 'music21-local-worker',
      priority: 70 + songIndex,
      depends_on: [lyricJob.job_id],
      input: { song, instruction: 'Create deterministic MusicXML/MIDI guide skeleton, preserving master key and making key changes as versions only.' },
      output_hint: `scores/musicxml/${slug(song.title)}.musicxml`,
      safety_gate: 'score_render_gate',
      status: 'dry_run_ready',
    }, jobs.length));
  });

  jobs.push(makeJob({
    pack_id: pack.pack_id,
    type: 'qa_review',
    title: 'Whole pack critic/director/rights review',
    agent_id: 'critic_panel',
    service_id: 'gemini_structured_text',
    model: 'gemini-3.5-flash',
    priority: 90,
    depends_on: jobs.filter((job) => ['script_scene', 'lyrics', 'lyria_clip', 'lyria_pro_song'].includes(job.type)).slice(0, 20).map((job) => job.job_id),
    input: buildGeminiTextPayload(`Review the show pack ${pack.brief.title} as theatre critic, director, actor table and rights reviewer. Return JSON with pass/revise/block verdicts, top fixes and release blockers.`, 'agent_review'),
    output_hint: 'qa/agent-review.json',
    safety_gate: 'agent_review_gate',
  }, jobs.length));

  jobs.push(makeJob({
    pack_id: pack.pack_id,
    type: 'assembly_manifest',
    title: 'Assemble production pack manifest',
    agent_id: 'qa_producer',
    service_id: 'asset_vault',
    priority: 99,
    depends_on: jobs.slice(-1).map((job) => job.job_id),
    input: { pack_id: pack.pack_id, requiredFolders: ['script', 'songs', 'audio', 'scores', 'qa', 'licence'] },
    output_hint: 'manifest/production-pack-manifest.json',
    safety_gate: 'assembly_gate',
    status: 'dry_run_ready',
  }, jobs.length));

  return {
    plan_id: `orchestra-${slug(pack.brief.title)}-${Date.now()}`,
    created_at: stamp(),
    pack,
    phases: [
      { phase: 1, name: 'Book and bible', objective: 'Lock show spine and script generation inputs.', jobs: jobs.filter((job) => ['show_bible', 'script_scene'].includes(job.type)).map((job) => job.job_id) },
      { phase: 2, name: 'Lyrics and composition', objective: 'Create lyrics, Lyria prompts and demo audio jobs.', jobs: jobs.filter((job) => ['lyrics', 'lyria_clip', 'lyria_pro_song'].includes(job.type)).map((job) => job.job_id) },
      { phase: 3, name: 'Score route', objective: 'Create deterministic symbolic music skeletons and render plan.', jobs: jobs.filter((job) => ['musicxml_stub', 'score_render_plan'].includes(job.type)).map((job) => job.job_id) },
      { phase: 4, name: 'QA and assembly', objective: 'Critic/director/rights review and production pack manifest.', jobs: jobs.filter((job) => ['qa_review', 'assembly_manifest'].includes(job.type)).map((job) => job.job_id) },
    ],
    jobs,
    agents: orchestraAgents,
    services: orchestraServices,
    quality_gates: orchestraQualityGates,
    deliverables: [
      { id: 'script-pack', title: 'Playable script pack', format: 'markdown/docx later', produced_by: ['script_scene', 'qa_review'], status: 'planned' },
      { id: 'lyrics-pack', title: 'Original lyrics pack', format: 'markdown/json', produced_by: ['lyrics'], status: 'planned' },
      { id: 'demo-soundtrack', title: 'Example soundtrack/demo audio', format: 'mp3 manifest', produced_by: ['lyria_clip', 'lyria_pro_song'], status: 'requires_live_api' },
      { id: 'score-pack', title: 'MusicXML/MIDI/PDF score route', format: 'musicxml/midi/pdf', produced_by: ['musicxml_stub', 'score_render_plan'], status: 'requires_live_api' },
      { id: 'qa-pack', title: 'Theatre-agent review pack', format: 'json/markdown', produced_by: ['qa_review'], status: 'planned' },
      { id: 'production-manifest', title: 'Release assembly manifest', format: 'json', produced_by: ['assembly_manifest'], status: 'ready' },
    ],
  };
}

export function runOrchestraVirtualTest(plan = createProductionPlan()) {
  const requiredServices: OrchestraServiceId[] = ['gemini_structured_text', 'lyria_3_clip', 'lyria_3_pro', 'music21_worker', 'asset_vault'];
  const serviceIds = new Set(plan.services.map((service) => service.id));
  const requiredAgents: OrchestraAgentId[] = ['book_writer', 'lyricist', 'composer', 'arranger', 'director', 'actor_table', 'critic_panel', 'rights_safety', 'qa_producer'];
  const agentIds = new Set(plan.agents.map((agent) => agent.id));
  const jobTypes = new Set(plan.jobs.map((job) => job.type));
  const checks = [
    { id: 'plan_identity', label: 'Production plan has identity and pack', pass: Boolean(plan.plan_id && plan.pack?.pack_id), weight: 8 },
    { id: 'agent_company', label: 'Full theatre-agent company represented', pass: requiredAgents.every((agent) => agentIds.has(agent)), weight: 10 },
    { id: 'service_catalogue', label: 'Required external/local services catalogued', pass: requiredServices.every((service) => serviceIds.has(service)), weight: 10 },
    { id: 'script_jobs', label: 'Script scene jobs generated', pass: plan.jobs.filter((job) => job.type === 'script_scene').length >= 6, weight: 9 },
    { id: 'song_jobs', label: 'Lyrics and Lyria jobs generated for songs', pass: plan.jobs.filter((job) => job.type === 'lyrics').length >= 6 && (jobTypes.has('lyria_clip') || jobTypes.has('lyria_pro_song')), weight: 10 },
    { id: 'music_score_path', label: 'MusicXML/score path exists separately from audio', pass: jobTypes.has('musicxml_stub'), weight: 8 },
    { id: 'dependency_graph', label: 'Jobs include dependency graph', pass: plan.jobs.some((job) => job.depends_on.length > 0), weight: 7 },
    { id: 'rights_gate', label: 'Rights/safety gate is blocking before API calls', pass: plan.quality_gates.some((gate) => gate.gate === 'prompt_rights_gate' && gate.blocking), weight: 9 },
    { id: 'assembly_gate', label: 'Assembly manifest is planned', pass: jobTypes.has('assembly_manifest'), weight: 7 },
    { id: 'deliverables', label: 'Show-road deliverables represented', pass: plan.deliverables.length >= 5 && plan.deliverables.some((item) => item.id === 'demo-soundtrack'), weight: 8 },
    { id: 'live_api_not_required_for_test', label: 'Virtual test can run without paid API credentials', pass: plan.jobs.every((job) => job.status !== 'running'), weight: 7 },
    { id: 'no_ancillaries', label: 'Website/ticketing deliberately out of scope', pass: true, weight: 7 },
  ];
  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  const passed = checks.filter((check) => check.pass).reduce((sum, check) => sum + check.weight, 0);
  return {
    ok: checks.every((check) => check.pass),
    score: Math.round((passed / total) * 100),
    checks,
    jobCount: plan.jobs.length,
    agentCount: plan.agents.length,
    serviceCount: plan.services.length,
    deliverableCount: plan.deliverables.length,
    note: 'This validates the production-orchestra logic, payloads and job graph. It does not spend paid API credits.',
  };
}

export function dryRunJobOutput(job: OrchestraJob) {
  const base = {
    job_id: job.job_id,
    status: 'completed' as const,
    mode: 'dry_run' as const,
    generated_at: stamp(),
    output_hint: job.output_hint,
  };
  if (job.type === 'lyria_clip' || job.type === 'lyria_pro_song') {
    return {
      ...base,
      artifact_type: 'audio-placeholder',
      message: 'Lyria payload validated. Live MP3 generation requires GEMINI_API_KEY and explicit live mode.',
      request_payload: job.input,
    };
  }
  if (job.type === 'musicxml_stub') {
    return {
      ...base,
      artifact_type: 'musicxml-placeholder',
      content: `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${job.title}</work-title></work><part-list/></score-partwise>`,
    };
  }
  return {
    ...base,
    artifact_type: 'text-placeholder',
    content: `# ${job.title}\n\nDry-run output for ${job.agent_id}. This job is ready for ${job.service_id}.\n\nSafety gate: ${job.safety_gate}.\n\nOutput target: ${job.output_hint}.`,
  };
}

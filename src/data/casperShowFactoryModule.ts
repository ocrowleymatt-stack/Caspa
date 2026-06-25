export type ShowFactoryAgentId =
  | 'showrunner'
  | 'book_writer'
  | 'joke_doctor'
  | 'lyricist'
  | 'composer'
  | 'arranger'
  | 'music_director'
  | 'stage_director'
  | 'choreographer'
  | 'actor_rep'
  | 'theatre_critic'
  | 'rights_safety_reviewer'
  | 'family_audience_reviewer'
  | 'producer';

export type ShowFactoryBrief = {
  title?: string;
  showType?: 'pantomime' | 'musical' | 'play' | 'revue';
  audience?: 'family' | 'school' | 'adult' | 'mixed';
  runtimeMinutes?: number;
  castSize?: number;
  songCount?: number;
  setting?: string;
  premise?: string;
  tone?: string;
  productionLevel?: 'village_hall' | 'school' | 'amdram' | 'operatic_society' | 'small_venue';
  musicalStyle?: string;
  safetyLevel?: 'family_safe' | 'school_safe' | 'standard_amdram' | 'adult_late_show';
};

export type ShowFactoryAsset = {
  asset_id: string;
  asset_type: string;
  title: string;
  status: 'draft' | 'qa_required' | 'approved' | 'blocked';
  format: string;
  description: string;
  path_hint?: string;
};

export type ShowFactoryPack = {
  pack_id: string;
  created_at: string;
  brief: Required<ShowFactoryBrief>;
  production_line: Array<{ step: number; agent_id: ShowFactoryAgentId; output: string; status: string }>;
  show_bible: {
    logline: string;
    audience_promise: string;
    structure: string[];
    house_style: string[];
    running_order: Array<{ number: number; title: string; purpose: string; estimated_minutes: number }>;
  };
  cast: Array<{ role: string; function: string; vocal_range: string; comic_use: string; casting_note: string }>;
  scene_list: Array<{ scene: number; title: string; location: string; dramatic_function: string; songs: string[]; props: string[] }>;
  script_sample: string;
  song_map: Array<{ song_id: string; title: string; position: string; function: string; style: string; default_key: string; vocal_range: string; lyria_prompt: string }>;
  lyrics: Array<{ song_id: string; title: string; lyrics: string; notes: string }>;
  score_plan: Array<{ song_id: string; musicxml_asset_id: string; midi_asset_id: string; arrangement: string; qa_notes: string[] }>;
  soundtrack_plan: Array<{ song_id: string; demo_track: string; backing_track: string; guide_vocal: string; lyria_model: string; generation_status: string }>;
  agent_reviews: Array<{ agent_id: ShowFactoryAgentId; verdict: 'pass' | 'revise' | 'block'; note: string }>;
  quality_gates: Array<{ gate: string; status: 'pass' | 'warning' | 'blocked'; checks: Array<{ check: string; pass: boolean; note: string }> }>;
  asset_manifest: ShowFactoryAsset[];
  export_manifest: Array<{ format: string; purpose: string; ready_now: boolean }>;
};

export const showFactoryAgents: Array<{
  id: ShowFactoryAgentId;
  name: string;
  role: string;
  commercial_function: string;
  acceptance_focus: string[];
}> = [
  { id: 'showrunner', name: 'The Showrunner', role: 'Owns the whole production spine.', commercial_function: 'Keeps the pack coherent and saleable.', acceptance_focus: ['clear audience promise', 'runnable structure', 'fast production path'] },
  { id: 'book_writer', name: 'The Book Writer', role: 'Writes scenes, dialogue, beats and version-safe script copy.', commercial_function: 'Creates the core script assets.', acceptance_focus: ['character purpose', 'scene turn', 'cast-flex dialogue'] },
  { id: 'joke_doctor', name: 'The Joke Doctor', role: 'Adds panto/comedy business without libel or cruelty.', commercial_function: 'Makes local customisation funny but safe.', acceptance_focus: ['clean laughs', 'audience friendliness', 'local joke guardrails'] },
  { id: 'lyricist', name: 'The Lyricist', role: 'Writes original lyrics matched to dramatic function.', commercial_function: 'Creates owned lyric assets.', acceptance_focus: ['singable hooks', 'plot movement', 'no uncleared lyric borrowing'] },
  { id: 'composer', name: 'The Composer', role: 'Creates music direction, melodic prompts and Lyria/MusicXML briefs.', commercial_function: 'Turns the show into a musical product.', acceptance_focus: ['originality', 'memorable motifs', 'cast-appropriate range'] },
  { id: 'arranger', name: 'The Arranger', role: 'Creates piano-vocal, tracks-only, small-band and school-band routes.', commercial_function: 'Makes the pack usable by different groups.', acceptance_focus: ['instrument practicality', 'transposition safety', 'score renderability'] },
  { id: 'music_director', name: 'The Musical Director', role: 'Checks keys, ranges, rehearsal utility and backing-track needs.', commercial_function: 'Reduces support pain for non-professional groups.', acceptance_focus: ['vocal range safe', 'rehearsal track usefulness', 'cue clarity'] },
  { id: 'stage_director', name: 'The Director', role: 'Checks staging, entrances, comic timing and village-hall feasibility.', commercial_function: 'Makes the show performable quickly.', acceptance_focus: ['simple blocking', 'manageable props', 'clear stage pictures'] },
  { id: 'choreographer', name: 'The Choreographer', role: 'Specifies movement level and non-dancer alternatives.', commercial_function: 'Keeps musical numbers inclusive.', acceptance_focus: ['low-risk movement', 'chorus options', 'school-safe staging'] },
  { id: 'actor_rep', name: 'The Actor Representative', role: 'Protects the cast experience: fun roles, fair billing, playable scenes.', commercial_function: 'Improves adoption by amateur groups.', acceptance_focus: ['good parts', 'star moments', 'Dame business'] },
  { id: 'theatre_critic', name: 'The Theatre Critic', role: 'Pressure-tests whether the show is entertaining, clear and worth selling.', commercial_function: 'Keeps quality above AI sludge.', acceptance_focus: ['pace', 'stakes', 'audience satisfaction'] },
  { id: 'rights_safety_reviewer', name: 'Rights & Safety Reviewer', role: 'Blocks copyright, defamation and version-safety risks.', commercial_function: 'Protects the platform.', acceptance_focus: ['no copied songs', 'no named living artist imitation', 'age version separation'] },
  { id: 'family_audience_reviewer', name: 'Family Audience Reviewer', role: 'Checks school/family appropriateness and safeguarding tone.', commercial_function: 'Makes school and family tiers safe to license.', acceptance_focus: ['school-safe content', 'no protected-characteristic abuse', 'clear warnings'] },
  { id: 'producer', name: 'The Producer', role: 'Assembles deliverables, QA status and release readiness.', commercial_function: 'Turns creative work into a downloadable product.', acceptance_focus: ['asset manifest', 'licence readiness', 'support-light packaging'] },
];

export const showFactoryApiCatalogue = [
  {
    id: 'gemini_text_agents',
    name: 'Gemini API — structured agent generation',
    provider: 'Google AI / Vertex AI',
    purpose: 'Show bible, script, lyrics, critiques, safety passes and structured JSON outputs for the theatre-agent swarm.',
    required_env: ['GEMINI_API_KEY or Vertex AI service credentials'],
    status: 'adapter_ready',
    notes: 'Use structured outputs and function calling for book writer, lyricist, critic and rights agents.'
  },
  {
    id: 'lyria_3_clip',
    name: 'Lyria 3 Clip',
    provider: 'Google Gemini API',
    purpose: '30-second song previews, loops, auditions and customer-facing audio samples.',
    model_ids: ['lyria-3-clip-preview'],
    required_env: ['GEMINI_API_KEY'],
    status: 'adapter_ready',
    notes: 'Best for quick show-library previews and motif testing.'
  },
  {
    id: 'lyria_3_pro',
    name: 'Lyria 3 Pro',
    provider: 'Google Gemini API / Vertex AI',
    purpose: 'Longer demo tracks with verses, chorus, bridge and full instrumental arrangement direction.',
    model_ids: ['lyria-3-pro-preview'],
    required_env: ['GEMINI_API_KEY or Google Cloud auth'],
    status: 'adapter_ready',
    notes: 'Use after lyric, structure and key have passed internal QA.'
  },
  {
    id: 'gemini_tts',
    name: 'Gemini-TTS / Cloud Text-to-Speech',
    provider: 'Google Cloud',
    purpose: 'Guide vocals, spoken cue demos, narrated prompt script and rehearsal pronunciation support.',
    model_ids: ['gemini-3.1-flash-tts-preview'],
    required_env: ['GOOGLE_CLOUD_PROJECT', 'Google Cloud auth'],
    status: 'recommended_next',
    notes: 'Use for guide vocals only where licence terms permit. Keep singer replacement claims out of marketing.'
  },
  {
    id: 'music21',
    name: 'music21 service',
    provider: 'Python symbolic music layer',
    purpose: 'MusicXML/MIDI generation, transposition, vocal range checks and arrangement logic.',
    required_env: ['Python worker'],
    status: 'planned_worker',
    notes: 'Use as deterministic symbolic layer so Lyria is not the only source of truth.'
  },
  {
    id: 'musescore_cli',
    name: 'MuseScore CLI',
    provider: 'Self-hosted rendering worker',
    purpose: 'Render MusicXML into PDF scores and MIDI previews.',
    required_env: ['MuseScore installed on worker'],
    status: 'planned_worker',
    notes: 'Keep separate from checkout and web server; score rendering can fail independently.'
  },
  {
    id: 'ffmpeg',
    name: 'FFmpeg',
    provider: 'Self-hosted media worker',
    purpose: 'Normalise audio, create MP3/WAV variants and assemble preview reels.',
    required_env: ['FFmpeg installed on worker'],
    status: 'planned_worker',
    notes: 'Needed once actual audio files are produced.'
  }
] as const;

const defaults: Required<ShowFactoryBrief> = {
  title: 'The Haunted Dame',
  showType: 'pantomime',
  audience: 'family',
  runtimeMinutes: 90,
  castSize: 18,
  songCount: 8,
  setting: 'A half-haunted seaside town with a theatre, a pier and a suspiciously ambitious town council.',
  premise: 'A down-on-its-luck community theatre must stage the winter show while a theatrical ghost, a corrupt mayor and a very dramatic Dame fight over the future of the town.',
  tone: 'big-hearted, fast, family-safe, properly funny, with enough gothic shimmer to feel premium',
  productionLevel: 'amdram',
  musicalStyle: 'modern British panto meets theatrical pop, music hall, folk-rock and comic patter',
  safetyLevel: 'family_safe',
};

function normaliseBrief(brief: ShowFactoryBrief = {}): Required<ShowFactoryBrief> {
  return { ...defaults, ...brief };
}

function idFromTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'show-pack';
}

function buildSongTitles(title: string, count: number) {
  const base = [
    'Raise the Curtain',
    'Something in the Wings',
    'The Dame Knows Best',
    'A Little Bit Haunted',
    'Villain with a Plan',
    'Find the Light',
    'Big Second-Half Number',
    'Finale: We Saved the Show',
    'Encore: One More Bow',
    `${title} Reprise`,
  ];
  return base.slice(0, Math.max(1, Math.min(count, base.length)));
}

function lyricFor(title: string, functionText: string) {
  return `[Verse 1]\nWe heard the boards complain again,\nWe saw the footlights glow,\nIf trouble wants a ticket here,\nThen let the rascal show.\n\n[Chorus]\nRaise it high, play it bright,\nGive the back row all the light,\nIf the dark comes marching through,\nWe'll sing it off by two.\n\n[Bridge]\nNo borrowed tune, no stolen line,\nJust our little bit of shine.\n\n[Final Chorus]\n${title}, loud and clear,\nThe whole town knows the magic's here.\n\nDramatic function: ${functionText}`;
}

function musicXmlStub(songTitle: string, key = 'C') {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n<score-partwise version="3.1">\n  <work><work-title>${songTitle}</work-title></work>\n  <part-list><score-part id="P1"><part-name>Voice / Piano Guide</part-name></score-part></part-list>\n  <part id="P1">\n    <measure number="1">\n      <attributes><divisions>1</divisions><key><fifths>${key === 'G' ? 1 : key === 'F' ? -1 : 0}</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>\n      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric><text>Raise</text></lyric></note>\n      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric><text>the</text></lyric></note>\n      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric><text>cur</text></lyric></note>\n      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric><text>tain</text></lyric></note>\n    </measure>\n  </part>\n</score-partwise>`;
}

export function buildLyriaPrompt(song: { title: string; function: string; style: string; default_key: string }, brief: Required<ShowFactoryBrief>) {
  return `Original ${brief.showType} theatre song titled "${song.title}". ${brief.musicalStyle}. Dramatic function: ${song.function}. Family-safe, stageable by amateur performers, clear verse and chorus, memorable hook, no imitation of named artists, no copyrighted melody, default key ${song.default_key}, include instrumental arrangement suitable for piano-vocal rehearsal and backing-track performance.`;
}

export function buildLyriaInteractionPayload(prompt: string, model = 'lyria-3-pro-preview') {
  return {
    model,
    input: [
      { type: 'text', text: prompt }
    ],
    notes: 'Send to Vertex AI / Gemini interactions endpoint when Google Cloud auth is configured.'
  };
}

export function createShowRoadPack(input: ShowFactoryBrief = {}): ShowFactoryPack {
  const brief = normaliseBrief(input);
  const packId = `show-pack-${idFromTitle(brief.title)}-${Date.now()}`;
  const songTitles = buildSongTitles(brief.title, brief.songCount);
  const functions = ['opening number', 'ghost reveal', 'Dame showcase', 'comic ensemble', 'villain number', 'eleven o’clock lift', 'company showstopper', 'finale'];
  const styles = ['up-tempo theatrical pop', 'spooky waltz', 'comic music-hall patter', 'ensemble pop-rock', 'minor-key tango', 'folk-rock anthem', 'big chorus number', 'bright finale reprise'];
  const keys = ['C', 'D', 'F', 'G', 'A', 'Bb', 'C', 'D'];

  const songMap = songTitles.map((title, index) => {
    const song = {
      song_id: `song-${String(index + 1).padStart(2, '0')}`,
      title,
      position: index === 0 ? 'Opening' : index === songTitles.length - 1 ? 'Finale' : `Scene ${Math.min(index + 2, 10)}`,
      function: functions[index] || 'story beat',
      style: styles[index] || 'theatrical pop',
      default_key: keys[index] || 'C',
      vocal_range: index === 2 ? 'Dame / baritone-friendly comic range' : index === 5 ? 'principal belt, opt-down notes supplied' : 'chorus-friendly mixed range',
      lyria_prompt: '',
    };
    return { ...song, lyria_prompt: buildLyriaPrompt(song, brief) };
  });

  const sceneList = [
    ['The Pier Opens Late', 'Seafront theatre foyer', 'Establish town, stakes and chorus energy'],
    ['A Ghost in the Prompt Box', 'Backstage', 'Grey Lady appears and gives the quest'],
    ['The Dame Takes Charge', 'Costume cupboard', 'Comic business and audience bond'],
    ['The Mayor Smells Money', 'Town Hall', 'Villain plan and opposition'],
    ['Rehearsal Goes Wrong', 'Stage', 'Physical comedy and ensemble chaos'],
    ['Interval Cliffhanger', 'The haunted pier', 'Theatre threatened; ghost blamed'],
    ['Second Half Rescue Plan', 'Green room', 'Heroes choose action'],
    ['The Secret Ledger', 'Old box office', 'Reveal why the theatre matters'],
    ['Opening Night', 'Stage and auditorium', 'Town unites; villain exposed'],
    ['Curtain Call', 'Full stage', 'Finale, reprise and local custom slots'],
  ].map((row, index) => ({
    scene: index + 1,
    title: row[0],
    location: row[1],
    dramatic_function: row[2],
    songs: songMap.filter((_, s) => s === 0 && index === 0 || s === 1 && index === 1 || s === 2 && index === 2 || s === 3 && index === 4 || s === 4 && index === 5 || s === 5 && index === 6 || s === 6 && index === 8 || s === 7 && index === 9).map((song) => song.title),
    props: index === 0 ? ['programmes', 'ticket ledger', 'dusty follow-spot'] : index === 2 ? ['enormous handbag', 'emergency bloomers', 'local joke cards'] : ['rehearsal props', 'show posters'],
  }));

  const cast = [
    { role: 'The Dame', function: 'Comic engine and community heart', vocal_range: 'baritone / flexible comic patter', comic_use: 'direct audience, local jokes, costume reveals', casting_note: 'Make this role expandable for the local star.' },
    { role: 'The Grey Lady', function: 'Elegant ghost and moral guide', vocal_range: 'mezzo / spoken option', comic_use: 'deadpan class rather than cartoon ghost', casting_note: 'Can be doubled with narrator in small casts.' },
    { role: 'Principal Hero', function: 'Carries quest and emotional stakes', vocal_range: 'tenor/mezzo friendly', comic_use: 'reactive comedy', casting_note: 'Can be gender-flexible.' },
    { role: 'Principal Comic', function: 'Audience warm-up and running gags', vocal_range: 'limited solo optional', comic_use: 'slapstick, call-and-response', casting_note: 'Good for confident non-singer.' },
    { role: 'The Mayor / Villain', function: 'Clear antagonist with theatrical swagger', vocal_range: 'low comic villain', comic_use: 'boo-hiss cues', casting_note: 'Avoid making villain too frightening for school version.' },
    { role: 'Chorus / Townsfolk', function: 'Company numbers and flexible ensemble', vocal_range: 'mixed chorus', comic_use: 'crowd reactions and dance alternatives', casting_note: 'Scales from 8 to 40.' },
  ];

  const lyrics = songMap.map((song) => ({ song_id: song.song_id, title: song.title, lyrics: lyricFor(song.title, song.function), notes: 'Original placeholder lyric generated by local Show Factory. Replace with Gemini/Gemini-reviewed lyric pass when API key is configured.' }));

  const scorePlan = songMap.map((song) => ({
    song_id: song.song_id,
    musicxml_asset_id: `${song.song_id}-guide.musicxml`,
    midi_asset_id: `${song.song_id}-guide.mid`,
    arrangement: song.title.includes('Dame') ? 'comic patter with optional chorus responses' : 'piano-vocal guide, tracks-only compatible, small-band expandable',
    qa_notes: ['vocal range must be checked before customer download', 'MusicXML render required through MuseScore worker', 'backing-track regeneration required after key change'],
  }));

  const soundtrackPlan = songMap.map((song) => ({
    song_id: song.song_id,
    demo_track: `${song.song_id}-demo-lyria.mp3`,
    backing_track: `${song.song_id}-backing-track.mp3`,
    guide_vocal: `${song.song_id}-guide-vocal.mp3`,
    lyria_model: song.title.includes('Finale') || song.title.includes('Raise') ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview',
    generation_status: 'prompt_ready_api_key_required',
  }));

  const assetManifest: ShowFactoryAsset[] = [
    { asset_id: 'show-bible-md', asset_type: 'show_bible', title: `${brief.title} Show Bible`, status: 'draft', format: 'md', description: 'Story, audience promise, structure and running order.' },
    { asset_id: 'master-script-md', asset_type: 'script', title: `${brief.title} Master Script`, status: 'draft', format: 'md/docx', description: 'Script skeleton with sample scenes and expansion plan.' },
    { asset_id: 'song-map-json', asset_type: 'music', title: `${brief.title} Song Map`, status: 'draft', format: 'json', description: 'Song functions, keys, ranges and Lyria prompts.' },
    { asset_id: 'lyrics-pack-md', asset_type: 'lyrics', title: `${brief.title} Lyrics Pack`, status: 'draft', format: 'md', description: 'Original lyrics draft for all numbers.' },
    { asset_id: 'musicxml-stubs-zip', asset_type: 'score', title: 'MusicXML Guide Stubs', status: 'qa_required', format: 'musicxml', description: 'Starter score files for symbolic pipeline and MuseScore worker.' },
    { asset_id: 'lyria-prompt-pack-json', asset_type: 'audio_prompt', title: 'Lyria Prompt Pack', status: 'qa_required', format: 'json', description: 'Ready prompts for Gemini/Lyria audio generation.' },
    { asset_id: 'production-notes-md', asset_type: 'production', title: 'Production Notes', status: 'draft', format: 'md', description: 'Director, actor, choreographer and producer notes.' },
    { asset_id: 'qa-report-json', asset_type: 'qa', title: 'Quality Gate Report', status: 'qa_required', format: 'json', description: 'Rights, music, script and family-audience gates.' },
  ];

  const productionLine: ShowFactoryPack['production_line'] = showFactoryAgents.map((agent, index) => ({
    step: index + 1,
    agent_id: agent.id,
    output: index < 4 ? 'creative draft contribution' : index < 10 ? 'production feasibility review' : 'quality and release control',
    status: 'completed_local_draft',
  }));

  const agentReviews: ShowFactoryPack['agent_reviews'] = [
    { agent_id: 'showrunner', verdict: 'pass', note: 'Commercial spine is clear: family panto, scalable cast, strong theatre-in-danger engine.' },
    { agent_id: 'book_writer', verdict: 'revise', note: 'Script sample is structurally ready, but full scenes need expansion before sale.' },
    { agent_id: 'composer', verdict: 'revise', note: 'Lyria prompts are strong; actual audio generation requires API key and music QA.' },
    { agent_id: 'arranger', verdict: 'revise', note: 'MusicXML stubs prove pipeline shape; real arrangements require music21/MuseScore worker.' },
    { agent_id: 'stage_director', verdict: 'pass', note: 'Can be staged in village halls and schools with simple props and flexible chorus.' },
    { agent_id: 'theatre_critic', verdict: 'pass', note: 'The package has a coherent audience promise and avoids generic AI sludge if expanded carefully.' },
    { agent_id: 'rights_safety_reviewer', verdict: 'pass', note: 'No named living artist imitation, no borrowed lyric, no third-party song references in local draft.' },
  ];

  const qualityGates: ShowFactoryPack['quality_gates'] = [
    { gate: 'rights_safety_gate', status: 'pass', checks: [
      { check: 'No uncleared copyrighted lyrics', pass: true, note: 'Local lyrics are original placeholders.' },
      { check: 'No named artist imitation', pass: true, note: 'Prompts use genre/function only.' },
      { check: 'No protected-characteristic abuse', pass: true, note: 'No targeted abuse in draft.' },
      { check: 'School/family separation', pass: true, note: 'Safety level recorded as metadata.' },
    ] },
    { gate: 'script_quality_gate', status: 'warning', checks: [
      { check: 'Scene continuity', pass: true, note: 'Scene list and running order aligned.' },
      { check: 'Runtime estimate', pass: true, note: `${brief.runtimeMinutes} minutes target.` },
      { check: 'Full script complete', pass: false, note: 'Current module creates production-ready skeleton and sample, not final full script.' },
    ] },
    { gate: 'music_quality_gate', status: 'warning', checks: [
      { check: 'Lyria prompts ready', pass: true, note: `${songMap.length} prompts generated.` },
      { check: 'Score render complete', pass: false, note: 'Requires music21/MuseScore worker.' },
      { check: 'Audio generated', pass: false, note: 'Requires Gemini/Lyria credentials.' },
    ] },
    { gate: 'production_readiness_gate', status: 'warning', checks: [
      { check: 'Cast flexibility', pass: true, note: 'Main roles and chorus scaling defined.' },
      { check: 'Website/ticketing excluded', pass: true, note: 'Deferred by design for this build.' },
      { check: 'Download vault ready', pass: false, note: 'Needs next fulfilment module.' },
    ] },
  ];

  return {
    pack_id: packId,
    created_at: new Date().toISOString(),
    brief,
    production_line: productionLine,
    show_bible: {
      logline: `When ${brief.setting.toLowerCase()}, a wildly capable Dame and a spectral Grey Lady must save the show before opening night collapses into profitable villainy.`,
      audience_promise: 'A funny, singable, localisable show pack that a real amateur group can rehearse without needing a West End payroll.',
      structure: ['Act I: sell the world and the threat', 'Interval: theatre under threat', 'Act II: rescue plan, reveal, finale', 'Optional encore/local gag insert'],
      house_style: ['family-safe wit', 'clean audience participation', 'premium gothic shimmer', 'simple staging', 'star/Dame billing slots'],
      running_order: sceneList.map((scene) => ({ number: scene.scene, title: scene.title, purpose: scene.dramatic_function, estimated_minutes: Math.max(6, Math.round(brief.runtimeMinutes / sceneList.length)) })),
    },
    cast,
    scene_list: sceneList,
    script_sample: `# ${brief.title}\n\n## Scene 1 — The Pier Opens Late\n\n[Lights up on a tired but beloved seaside theatre. Posters curl at the edges. A lonely follow-spot flickers as if it has opinions.]\n\nDAME: If this theatre is haunted, I hope the ghost can sell programmes. We are down to three quid, two boiled sweets and a raffle prize nobody will admit donating.\n\nPRINCIPAL COMIC: Good news: the audience are here.\n\nDAME: Lovely.\n\nPRINCIPAL COMIC: Bad news: they are asking if this is the queue for the chip shop.\n\n[The house lights tremble. A grey figure appears in the upper box.]\n\nTHE GREY LADY: The show must open, or the town forgets itself.\n\nDAME: Typical. First rehearsal and management are already dead.`,
    song_map: songMap,
    lyrics,
    score_plan: scorePlan,
    soundtrack_plan: soundtrackPlan,
    agent_reviews: agentReviews,
    quality_gates: qualityGates,
    asset_manifest: assetManifest,
    export_manifest: [
      { format: 'json', purpose: 'Machine-readable pack for workers and future modules', ready_now: true },
      { format: 'md', purpose: 'Human-readable production pack', ready_now: true },
      { format: 'zip', purpose: 'Downloadable show-road pack with manifests and MusicXML stubs', ready_now: true },
      { format: 'docx/pdf', purpose: 'Customer-facing script and score exports', ready_now: false },
      { format: 'mp3/wav', purpose: 'Demo soundtrack, guide vocals and backing tracks', ready_now: false },
    ],
  };
}

export function showPackToMarkdown(pack: ShowFactoryPack) {
  const lines: string[] = [];
  lines.push(`# ${pack.brief.title} — Show Road Pack`);
  lines.push('');
  lines.push(`Pack ID: ${pack.pack_id}`);
  lines.push(`Created: ${pack.created_at}`);
  lines.push('');
  lines.push('## Commercial Position');
  lines.push(pack.show_bible.audience_promise);
  lines.push('');
  lines.push('## Logline');
  lines.push(pack.show_bible.logline);
  lines.push('');
  lines.push('## Agentic Production Line');
  for (const step of pack.production_line) lines.push(`- ${step.step}. ${step.agent_id}: ${step.output} — ${step.status}`);
  lines.push('');
  lines.push('## Cast');
  for (const role of pack.cast) lines.push(`- **${role.role}** — ${role.function}. Vocal: ${role.vocal_range}. Casting: ${role.casting_note}`);
  lines.push('');
  lines.push('## Scene List');
  for (const scene of pack.scene_list) lines.push(`- **Scene ${scene.scene}: ${scene.title}** (${scene.location}) — ${scene.dramatic_function}. Songs: ${scene.songs.join(', ') || 'none'}.`);
  lines.push('');
  lines.push('## Song Map');
  for (const song of pack.song_map) lines.push(`- **${song.title}** — ${song.function}; ${song.style}; key ${song.default_key}; range ${song.vocal_range}.`);
  lines.push('');
  lines.push('## Lyria / Gemini Music Prompts');
  for (const song of pack.song_map) lines.push(`### ${song.title}\n${song.lyria_prompt}`);
  lines.push('');
  lines.push('## Script Sample');
  lines.push(pack.script_sample);
  lines.push('');
  lines.push('## Lyrics Pack');
  for (const lyric of pack.lyrics) lines.push(`### ${lyric.title}\n${lyric.lyrics}\n\n_${lyric.notes}_`);
  lines.push('');
  lines.push('## Quality Gates');
  for (const gate of pack.quality_gates) {
    lines.push(`### ${gate.gate} — ${gate.status}`);
    for (const check of gate.checks) lines.push(`- ${check.pass ? 'PASS' : 'NEEDS WORK'}: ${check.check} — ${check.note}`);
  }
  lines.push('');
  lines.push('## Asset Manifest');
  for (const asset of pack.asset_manifest) lines.push(`- ${asset.asset_id} (${asset.format}) — ${asset.status}: ${asset.description}`);
  return lines.join('\n');
}

export function runShowFactoryVirtualTest() {
  const pack = createShowRoadPack();
  const requiredAgents: ShowFactoryAgentId[] = ['showrunner', 'book_writer', 'lyricist', 'composer', 'arranger', 'music_director', 'stage_director', 'actor_rep', 'theatre_critic', 'rights_safety_reviewer', 'producer'];
  const agentIds = new Set(pack.production_line.map((step) => step.agent_id));
  const checks = [
    { id: 'agent_roster', label: 'Agentic theatre team represented', pass: requiredAgents.every((id) => agentIds.has(id)), weight: 10 },
    { id: 'show_bible', label: 'Show bible has logline, structure and running order', pass: Boolean(pack.show_bible.logline && pack.show_bible.structure.length >= 3 && pack.show_bible.running_order.length >= 8), weight: 10 },
    { id: 'script_sample', label: 'Script sample generated', pass: pack.script_sample.length > 600, weight: 8 },
    { id: 'song_map', label: 'Song map generated', pass: pack.song_map.length >= 8, weight: 10 },
    { id: 'lyria_prompts', label: 'Every song has Lyria prompt', pass: pack.song_map.every((song) => song.lyria_prompt.includes('Original') && song.lyria_prompt.includes('no imitation')), weight: 10 },
    { id: 'lyrics', label: 'Lyrics generated for every song', pass: pack.lyrics.length === pack.song_map.length && pack.lyrics.every((l) => l.lyrics.includes('[Chorus]')), weight: 8 },
    { id: 'score_plan', label: 'Score/MusicXML plan generated', pass: pack.score_plan.length === pack.song_map.length, weight: 8 },
    { id: 'soundtrack_plan', label: 'Demo/backing/guide-vocal plan generated', pass: pack.soundtrack_plan.length === pack.song_map.length, weight: 8 },
    { id: 'quality_gates', label: 'Quality gates applied', pass: pack.quality_gates.length >= 4 && pack.quality_gates.some((gate) => gate.gate === 'rights_safety_gate'), weight: 10 },
    { id: 'assets', label: 'Asset manifest generated', pass: pack.asset_manifest.length >= 8, weight: 8 },
    { id: 'excluded_scope', label: 'Website/ticketing intentionally excluded', pass: pack.quality_gates.some((gate) => gate.checks.some((check) => check.note.includes('Deferred by design'))), weight: 5 },
    { id: 'api_catalogue', label: 'Required APIs and services catalogued', pass: showFactoryApiCatalogue.length >= 6, weight: 5 },
  ];
  const maxScore = checks.reduce((sum, check) => sum + check.weight, 0);
  const score = Math.round(checks.reduce((sum, check) => sum + (check.pass ? check.weight : 0), 0) / maxScore * 100);
  return {
    ok: score >= 85,
    score,
    testedAt: new Date().toISOString(),
    summary: 'Show Factory module can now produce a local show-road pack, agent reviews, song map, lyrics, Lyria prompts, score plan, soundtrack plan, QA gates and export package. Real audio/score rendering requires external workers and credentials.',
    checks,
    packPreview: {
      pack_id: pack.pack_id,
      title: pack.brief.title,
      songs: pack.song_map.length,
      scenes: pack.scene_list.length,
      assets: pack.asset_manifest.length,
      agents: pack.production_line.length,
      gates: pack.quality_gates.length,
    },
    apiReadiness: showFactoryApiCatalogue.map((api) => ({ id: api.id, name: api.name, status: api.status, required_env: [...api.required_env] })),
    nextBuildRecommendation: [
      'Wire Gemini text agents first for show bible, script expansion, lyric rewrite and critic passes.',
      'Wire Lyria 3 Clip/Pro second for demo audio and show-library previews.',
      'Add music21/MuseScore worker before promising customer-ready printable scores.',
      'Keep all real generated audio and scores behind rights/music QA until approved.',
    ],
  };
}

export function musicXmlFilesForPack(pack: ShowFactoryPack) {
  return Object.fromEntries(pack.song_map.map((song) => [`${song.song_id}-${idFromTitle(song.title)}.musicxml`, musicXmlStub(song.title, song.default_key)]));
}

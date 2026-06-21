import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.CASPA_TEST_PORT || 4319);
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = await mkdtemp(path.join(tmpdir(), 'caspa-virtual-test-'));
const startedAt = new Date().toISOString();
const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${BASE}${pathname}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return { response, body };
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const { body } = await request('/health');
      if (body?.ok) return body;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Server did not become ready within 15 seconds.');
}

const child = spawn(process.execPath, ['dist/server.cjs'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(PORT), CASPA_DATA_DIR: dataDir, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
child.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
child.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

try {
  const health = await waitForServer();
  record('server health endpoint', health.ok === true, `uptime ${Math.round(health.uptime || 0)}s`);

  const root = await fetch(`${BASE}/`);
  record('SPA root loads', root.ok && (await root.text()).includes('root'), `status ${root.status}`);

  const doctor = (await request('/api/doctor')).body;
  record('doctor checks pass', doctor.ok === true, `${doctor.checks?.filter((c) => c.pass).length}/${doctor.checks?.length} checks`);

  const status = (await request('/api/local/status')).body;
  record('local-first status endpoint', status.ok === true && status.storage === 'local-first', `documents ${status.documentCount}`);

  const sampleDocs = {
    'projects/virtual-panto': { id: 'virtual-panto', title: 'The Haunted Dame', type: 'show-pack', updatedAt: Date.now() },
    'projects/virtual-panto/assets/script': { title: 'The Haunted Dame — Family Script', approval_status: 'draft' },
  };
  const putDb = (await request('/api/local/db', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docs: sampleDocs }) })).body;
  record('local DB write', putDb.ok === true && putDb.documentCount === 2, `${putDb.documentCount} docs`);

  const readDb = (await request('/api/local/db')).body;
  record('local DB readback', readDb.docs?.['projects/virtual-panto']?.title === 'The Haunted Dame', 'project survived readback');

  const backup = (await request('/api/local/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docs: sampleDocs }) })).body;
  record('local backup create', backup.ok === true && backup.filename?.endsWith('.json'), backup.filename);

  const backups = (await request('/api/local/backups')).body;
  record('backup listing', backups.ok === true && backups.backups?.some((b) => b.filename === backup.filename), `${backups.backups?.length || 0} backups`);

  const restore = (await request('/api/local/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: backup.filename }) })).body;
  record('backup restore', restore.ok === true && restore.documentCount === 2, `from ${restore.restoredFrom}`);

  const model = (await request('/api/show-in-a-box/model')).body;
  record('show model endpoint', model.project_name?.includes('Show-in-a-Box'), model.version);

  const summary = (await request('/api/show-in-a-box/summary')).body;
  record('show summary endpoint', summary.selected_phases?.length === 4, `${summary.p0_feature_count} P0 features`);

  const phases = (await request('/api/show-in-a-box/phases?ids=2,3,4,5')).body;
  record('phases 2–5 endpoint', phases.phases?.length === 4, phases.phases?.map((p) => p.phase).join(','));

  const readiness = (await request('/api/show-in-a-box/readiness')).body;
  record('readiness score', readiness.ok === true && readiness.score >= 85, `${readiness.score}/100`);

  const virtual = (await request('/api/show-in-a-box/virtual-test', { method: 'POST' })).body;
  record('virtual workflow test', virtual.ok === true && virtual.workflowWalkthrough?.every((s) => s.result === 'pass'), virtual.filename);

  const factoryModule = (await request('/api/show-factory/module')).body;
  record('show factory module endpoint', factoryModule.ok === true && factoryModule.agents?.length >= 10, `${factoryModule.agents?.length || 0} agents`);

  const factoryApis = (await request('/api/show-factory/apis')).body;
  record('show factory API catalogue', factoryApis.ok === true && factoryApis.apis?.some((api) => api.id === 'lyria_3_pro'), `${factoryApis.apis?.length || 0} APIs`);

  const factoryPack = (await request('/api/show-factory/create-pack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief: { title: 'The Haunted Dame', songCount: 8, runtimeMinutes: 90 } }) })).body;
  record('show factory create pack', factoryPack.ok === true && factoryPack.pack?.song_map?.length >= 8 && factoryPack.pack?.asset_manifest?.length >= 8, `${factoryPack.pack?.song_map?.length || 0} songs`);

  const lyriaPayload = (await request('/api/show-factory/lyria-payload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: factoryPack.pack.song_map[0].lyria_prompt, model: 'lyria-3-pro-preview' }) })).body;
  record('lyria payload builder', lyriaPayload.ok === true && lyriaPayload.payload?.model === 'lyria-3-pro-preview', lyriaPayload.payload?.model);

  const factoryVirtual = (await request('/api/show-factory/virtual-test', { method: 'POST' })).body;
  record('show factory virtual test', factoryVirtual.ok === true && factoryVirtual.score >= 85, `${factoryVirtual.score}/100`);

  const factoryZip = await request('/api/show-factory/export-package', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pack: factoryPack.pack }) });
  record('show factory ZIP export', factoryZip.response.ok === true && factoryZip.response.headers.get('content-type')?.includes('application/zip'), 'zip generated');

  const orchestraModule = (await request('/api/show-orchestra/module')).body;
  record('production orchestra module endpoint', orchestraModule.ok === true && orchestraModule.planSummary?.jobs >= 20, `${orchestraModule.planSummary?.jobs || 0} jobs`);

  const orchestraServices = (await request('/api/show-orchestra/services')).body;
  record('production orchestra services endpoint', orchestraServices.ok === true && orchestraServices.services?.some((service) => service.id === 'lyria_3_pro'), `${orchestraServices.services?.length || 0} services`);

  const orchestraAgents = (await request('/api/show-orchestra/agents')).body;
  record('production orchestra agents endpoint', orchestraAgents.ok === true && orchestraAgents.agents?.some((agent) => agent.id === 'critic_panel'), `${orchestraAgents.agents?.length || 0} agents`);

  const orchestraPlan = (await request('/api/show-orchestra/create-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief: { title: 'The Haunted Dame', songCount: 8, runtimeMinutes: 90 } }) })).body;
  record('production orchestra create plan', orchestraPlan.ok === true && orchestraPlan.plan?.jobs?.length >= 20 && orchestraPlan.plan?.deliverables?.some((item) => item.id === 'demo-soundtrack'), `${orchestraPlan.plan?.jobs?.length || 0} jobs`);

  const orchestraJobs = (await request('/api/show-orchestra/jobs')).body;
  record('production orchestra job listing', orchestraJobs.ok === true && orchestraJobs.jobs?.length >= orchestraPlan.plan.jobs.length, `${orchestraJobs.jobs?.length || 0} jobs`);

  const firstAudioJob = orchestraPlan.plan.jobs.find((job) => job.type === 'lyria_clip' || job.type === 'lyria_pro_song');
  const dryJob = (await request(`/api/show-orchestra/jobs/${firstAudioJob.job_id}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'dry-run' }) })).body;
  record('production orchestra dry-run job', dryJob.ok === true && dryJob.result?.mode === 'dry_run', dryJob.result?.artifact_type || 'dry run');

  const pipeline = (await request('/api/show-orchestra/run-pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: orchestraPlan.plan, mode: 'dry-run', maxJobs: 6 }) })).body;
  record('production orchestra dry-run pipeline', pipeline.ok === true && pipeline.processed === 6, `${pipeline.processed} jobs`);

  const diagnostics = (await request('/api/show-orchestra/diagnostics')).body;
  record('production orchestra diagnostics', diagnostics.ok === true && diagnostics.commands?.ffmpeg, `gemini configured: ${diagnostics.liveGeminiConfigured}`);

  const orchestraVirtual = (await request('/api/show-orchestra/virtual-test', { method: 'POST' })).body;
  record('production orchestra virtual test', orchestraVirtual.ok === true && orchestraVirtual.score >= 85, `${orchestraVirtual.score}/100`);

  const orchestraZip = await request('/api/show-orchestra/export-package', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: orchestraPlan.plan }) });
  record('production orchestra ZIP export', orchestraZip.response.ok === true && orchestraZip.response.headers.get('content-type')?.includes('application/zip'), 'zip generated');

  const musicLabModule = (await request('/api/music-lab/module')).body;
  record('overnight music lab module endpoint', musicLabModule.ok === true && musicLabModule.cycleSummary?.jobs >= 50, `${musicLabModule.cycleSummary?.jobs || 0} jobs`);

  const musicLabServices = (await request('/api/music-lab/services')).body;
  record('overnight music lab services endpoint', musicLabServices.ok === true && musicLabServices.services?.some((service) => service.id === 'ollama_prompt_cycle'), `${musicLabServices.services?.length || 0} services`);

  const musicLabAgents = (await request('/api/music-lab/agents')).body;
  record('overnight music lab agents endpoint', musicLabAgents.ok === true && musicLabAgents.agents?.some((agent) => agent.id === 'composer_room'), `${musicLabAgents.agents?.length || 0} agents`);

  const musicCycle = (await request('/api/music-lab/create-cycle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief: { title: 'The Haunted Dame', songCount: 8, runtimeMinutes: 90 }, ollama: { model: 'llama3.1:8b', max_iterations_per_song: 3 } }) })).body;
  record('overnight music lab create cycle', musicCycle.ok === true && musicCycle.cycle?.jobs?.length >= 80 && musicCycle.cycle?.deliverables?.some((item) => item.id === 'morning-lyria-shortlist'), `${musicCycle.cycle?.jobs?.length || 0} jobs`);

  const musicJobs = (await request('/api/music-lab/jobs')).body;
  record('overnight music lab job listing', musicJobs.ok === true && musicJobs.jobs?.length >= musicCycle.cycle.jobs.length, `${musicJobs.jobs?.length || 0} jobs`);

  const firstOllamaJob = musicCycle.cycle.jobs.find((job) => job.service_id?.startsWith('ollama_'));
  const musicDryJob = (await request(`/api/music-lab/jobs/${firstOllamaJob.job_id}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'dry-run' }) })).body;
  record('overnight music lab dry-run job', musicDryJob.ok === true && musicDryJob.result?.mode === 'dry_run', musicDryJob.result?.artifact_type || 'dry run');

  const musicDryRun = (await request('/api/music-lab/run-overnight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cycle: musicCycle.cycle, mode: 'dry-run', maxJobs: 12 }) })).body;
  record('overnight music lab dry-run cycle', musicDryRun.ok === true && musicDryRun.processed === 12, `${musicDryRun.processed} jobs`);

  const musicDiagnostics = (await request('/api/music-lab/diagnostics')).body;
  record('overnight music lab diagnostics', musicDiagnostics.ok === true && typeof musicDiagnostics.ollamaReachable === 'boolean', `ollama reachable: ${musicDiagnostics.ollamaReachable}`);

  const musicVirtual = (await request('/api/music-lab/virtual-test', { method: 'POST' })).body;
  record('overnight music lab virtual test', musicVirtual.ok === true && musicVirtual.score >= 85, `${musicVirtual.score}/100`);

  const musicZip = await request('/api/music-lab/export-package', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cycle: musicCycle.cycle }) });
  record('overnight music lab ZIP export', musicZip.response.ok === true && musicZip.response.headers.get('content-type')?.includes('application/zip'), 'zip generated');

  const mdExport = await request('/api/show-in-a-box/export?format=md');
  record('show model markdown export', mdExport.response.headers.get('content-type')?.includes('text/markdown') && String(mdExport.body).includes('Phase 2'), 'markdown generated');

  const derivative = {
    id: 'derivative-virtual-test',
    projectId: 'virtual-panto',
    derivativeType: 'pressRelease',
    title: 'The Haunted Dame — Press Release',
    status: 'approved',
    updatedAt: new Date().toISOString(),
    templateId: 'press-release',
    content: '# The Haunted Dame arrives this winter\n\nA new panto package for village halls, schools and operatic societies.',
  };
  for (const format of ['md', 'txt', 'json', 'docx']) {
    const exported = await request('/api/documents/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectTitle: 'The Haunted Dame', derivative, format }) });
    const text = format === 'docx' ? '<binary-docx>' : String(exported.body).slice(0, 40);
    record(`document derivative export ${format}`, exported.response.ok === true, text.replace(/\n/g, ' '));
  }
} catch (error) {
  record('virtual test fatal error', false, error.message);
} finally {
  child.kill('SIGTERM');
}

const passed = results.filter((item) => item.pass).length;
const failed = results.length - passed;
const finishedAt = new Date().toISOString();
const report = `# Caspa Virtual Test Report\n\n- Started: ${startedAt}\n- Finished: ${finishedAt}\n- Data directory: ${dataDir}\n- Passed: ${passed}\n- Failed: ${failed}\n\n## Results\n\n${results.map((item) => `- ${item.pass ? 'PASS' : 'FAIL'} — ${item.name}${item.detail ? `: ${item.detail}` : ''}`).join('\n')}\n\n## Server log excerpt\n\n\`\`\`\n${serverLog.slice(-4000)}\n\`\`\`\n`;
await writeFile('VIRTUAL_TEST_REPORT.md', report, 'utf8');

if (failed) {
  console.error(`Virtual test failed: ${failed} failing check(s). See VIRTUAL_TEST_REPORT.md`);
  process.exit(1);
}
console.log(`Virtual test passed: ${passed}/${results.length}. See VIRTUAL_TEST_REPORT.md`);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import test from 'node:test';

const dist = path.join(process.cwd(), 'dist');
const hasDist = fs.existsSync(path.join(dist, 'index.html'));

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function createMockServer() {
  const project = {
    id: 'proj-1',
    title: 'Tide Tables',
    mode: 'novel',
    revision: 1,
    updatedAt: new Date().toISOString(),
    state: { brief: { idea: 'A clerk keeps the tide tables', title: 'Tide Tables', mode: 'novel' }, ingest: { sources: [] } },
  };
  const versions: any[] = [];
  let preview: any = null;
  let diagnosis: any = null;
  let rebuild: any = null;
  const manuscript = '# TITHE\n\nA clerk keeps the tide tables and notices the sea arriving a minute early.';

  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    if (url.startsWith('/api/v2/migration')) return json(res, 200, { success: true, data: { imported: 0, skipped: 0, empty: 0 } });
    if (url === '/api/projects' && req.method === 'GET') return json(res, 200, { success: true, data: { projects: versions.length || req.headers['x-has-project'] ? [project] : [] } });
    if (url === '/api/projects' && req.method === 'POST') {
      return json(res, 201, { success: true, data: project });
    }
    if (url.includes('/versions/latest') && req.method === 'GET') {
      return versions[0]
        ? json(res, 200, { success: true, data: versions[0] })
        : json(res, 404, { success: false, message: 'No immutable version has been saved yet.' });
    }
    if (url.includes('/versions') && req.method === 'GET') {
      return json(res, 200, { success: true, data: { versions: versions.map(({ content, ...rest }) => rest) } });
    }
    if (url.includes('/versions') && req.method === 'POST') {
      const version = { id: `v-${versions.length + 1}`, revision: versions.length + 1, name: 'Imported', trigger: 'ingest-promoted', content: manuscript, wordCount: 18, chapterCount: 1, createdAt: new Date().toISOString() };
      versions.unshift(version);
      return json(res, 201, { success: true, data: version });
    }
    if (url.includes('/draft-preview') && req.method === 'POST') {
      preview = { id: 'prev-1', status: 'previewed', chapterTitle: 'Next', content: 'A private preview chapter.', grounding: { summary: 'Continuity holds.' } };
      return json(res, 201, { success: true, data: preview });
    }
    if (url.includes('/draft-preview')) return json(res, 200, { success: true, data: preview });
    if (url.includes('/draft-previews/') && url.endsWith('/reject')) { preview = { ...preview, status: 'rejected' }; return json(res, 200, { success: true }); }
    if (url.includes('/draft-previews/') && url.endsWith('/accept')) {
      const version = { id: 'v-accept', revision: versions.length + 1, name: 'Accepted draft', trigger: 'draft-accepted', content: `${manuscript}\n\n# Next\n\nA private preview chapter.`, wordCount: 26, chapterCount: 2, createdAt: new Date().toISOString() };
      versions.unshift(version);
      preview = { ...preview, status: 'accepted' };
      return json(res, 200, { success: true, data: version });
    }
    if (url.includes('/diagnosis') && req.method === 'POST') {
      diagnosis = { id: 'd1', summary: 'The opening is held, but the second movement is late.', findings: [{ category: 'pacing', severity: 'major', recommendation: 'Arrive at the discrepancy sooner.' }] };
      return json(res, 201, { success: true, data: diagnosis });
    }
    if (url.includes('/diagnosis')) return json(res, 200, { success: true, data: diagnosis });
    if (url.includes('/rebuild/analyze')) {
      rebuild = { id: 'rb1', status: 'analyzed', analysis: { summary: 'Chapter 1 can be tightened.' }, changes: [] };
      return json(res, 201, { success: true, data: rebuild });
    }
    if (url.includes('/rebuild/plan')) {
      rebuild = { id: 'rb1', status: 'planned', analysis: { summary: 'Chapter 1 can be tightened.' }, changes: [{ id: 'chg-1', chapterTitle: 'TITHE', currentExcerpt: 'old', proposed: 'Rebuilt chapter preview.', rationale: 'Arrive sooner.', status: 'pending' }] };
      return json(res, 201, { success: true, data: rebuild });
    }
    if (url.includes('/rebuild')) return json(res, 200, { success: true, data: rebuild });
    if (url.includes('/changes/') && url.endsWith('/reject')) {
      rebuild = { ...rebuild, changes: rebuild.changes.map((change: any) => ({ ...change, status: 'rejected' })) };
      return json(res, 200, { success: true, data: rebuild });
    }
    if (url.includes('/changes/') && url.endsWith('/accept')) {
      const version = { id: 'v-rebuild', revision: versions.length + 1, name: 'Accepted rebuild', trigger: 'rebuild-accepted', content: '# TITHE\n\nRebuilt chapter preview.', wordCount: 4, chapterCount: 1, createdAt: new Date().toISOString() };
      versions.unshift(version);
      rebuild = { ...rebuild, changes: rebuild.changes.map((change: any) => ({ ...change, status: 'accepted' })) };
      return json(res, 201, { success: true, data: { plan: rebuild, version } });
    }
    if (url.includes('/ingest')) {
      project.revision += 1;
      return json(res, 201, { success: true, data: { source: { id: 's1', title: 'receipt' }, project, manuscriptUnchanged: true } });
    }
    if (url.includes('/artefacts')) return json(res, 200, { success: true, data: { project, manuscriptUnchanged: true } });
    if (url.includes('/workspace')) {
      return json(res, 200, { success: true, data: { project, latestVersion: versions[0] ? { revision: versions[0].revision, wordCount: versions[0].wordCount, chapterCount: versions[0].chapterCount, createdAt: versions[0].createdAt } : null, jobs: [], recovery: { available: false }, lastSave: versions[0]?.createdAt } });
    }
    if (url.includes('/export-preflight')) return json(res, 200, { success: true, data: { passed: true, checks: [{ id: 'content', label: 'Manuscript content', passed: true, detail: 'ok' }] } });
    if (url.includes('/jobs')) return json(res, 200, { success: true, data: { jobs: [] } });
    if (url === '/api/ai/call') {
      return json(res, 200, {
        result: '{"content":"The clerk is still washing the glass.","severity":"high","suggestions":["Let the tide arrive before the glass is clean."]}',
      });
    }
    if (url.startsWith('/api/')) return json(res, 200, { success: true, data: {} });

    const file = url === '/' ? '/index.html' : url.split('?')[0];
    const disk = path.join(dist, file.replace(/^\//, ''));
    if (hasDist && fs.existsSync(disk) && fs.statSync(disk).isFile()) {
      const type = disk.endsWith('.js') ? 'text/javascript' : disk.endsWith('.css') ? 'text/css' : 'text/html';
      res.writeHead(200, { 'Content-Type': type });
      createReadStream(disk).pipe(res);
      return;
    }
    res.writeHead(hasDist ? 404 : 200, { 'Content-Type': 'text/html' });
    res.end('<html><body><div id="root">Caspa</div></body></html>');
  });
  return server;
}

test('browser journeys walk the integrated desk against a mocked server', { skip: !hasDist }, async (t) => {
  const puppeteer = await import('puppeteer');
  const server = createMockServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    await page.goto(base, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
    });
    await page.reload({ waitUntil: 'networkidle0' });
    const local = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((item) => /Continue locally/i.test(item.textContent || ''));
      btn?.click();
      return Boolean(btn);
    });
    if (local) await page.waitForSelector('[data-testid="new-project-form"], textarea', { timeout: 15000 });

    await page.waitForSelector('[data-testid="new-project-form"] textarea, textarea[aria-label="Rough project idea"]');
    await page.type('textarea[aria-label="Rough project idea"]', 'A clerk keeps the tide tables and the sea arrives early.');
    await page.click('button.desk-primary');
    await page.waitForFunction(() => /Idea|Draft|Private writing desk/i.test(document.body.innerText));

    const widths = [1440, 1280, 1024, 768, 390];
    for (const width of widths) {
      await page.setViewport({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 8);
      assert.equal(overflow, false, `horizontal overflow at ${width}px`);
    }

    await page.click('[data-testid="desk-help-toggle"]');
    await page.waitForSelector('[data-testid="desk-help"]');
    assert.ok(await page.$('[data-testid="desk-help"]'));

    await page.click('[data-testid="desk-stage-draft"]');
    await page.waitForSelector('[data-testid="draft-with-caspa"]');
    const draftCopy = await page.$eval('[data-testid="draft-with-caspa"]', (node) => node.textContent || '');
    assert.match(draftCopy, /Chapter title/i);
    assert.match(draftCopy, /private preview/i);
    assert.ok(await page.$('[data-testid="draft-with-caspa"] input[aria-label="Chapter title"]'));

    await page.setViewport({ width: 1440, height: 900 });
    const columns = await page.evaluate(() => {
      const grid = document.querySelector('.hybrid-editor-grid');
      if (!grid) return 0;
      const style = window.getComputedStyle(grid);
      return style.gridTemplateColumns.split(' ').filter(Boolean).length;
    });
    assert.equal(columns, 2, 'desk should be manuscript + rail at desktop width');

    await page.click('textarea[aria-label="Manuscript"]');
    await page.type('textarea[aria-label="Manuscript"]', 'The clerk washed the same glass after the tide had already turned.');
    await page.click('[data-testid="desk-stage-workshop"]');
    await page.waitForSelector('[data-testid="workshop-panel"]');
    const workshopCopy = await page.$eval('[data-testid="workshop-panel"]', (node) => node.textContent || '');
    assert.match(workshopCopy, /What's holding/i);
    assert.doesNotMatch(workshopCopy, /Read the book/);
    assert.match(workshopCopy, /Ask the critics/i);
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="desk-critic-swarm"]') as HTMLButtonElement | null;
      return Boolean(button && !button.disabled && /Ask the critics/i.test(button.textContent || ''));
    });
    await page.click('[data-testid="desk-critic-swarm"]');
    await page.waitForSelector('[data-testid="desk-critique"]');
    const critique = await page.$eval('[data-testid="desk-critique"]', (node) => node.textContent || '');
    assert.match(critique, /washing the glass|critics|Atlas|severity|high/i);
    t.diagnostic(`journeys exercised at ${base}`);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

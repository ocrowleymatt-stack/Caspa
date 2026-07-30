#!/usr/bin/env bash
# Show in a Box spine smoke — pack → Just write → Workshop → Publish.
# Requires a running Caspa server (CASPA_SMOKE_URL, default http://127.0.0.1:3000).
set -euo pipefail

BASE="${CASPA_SMOKE_URL:-http://127.0.0.1:3000}"

fail() { echo "FAIL: $1"; exit 1; }
ok() { echo "OK: $1"; }

echo "Caspa show-spine smoke against $BASE"

curl -sf "$BASE/" | grep -qi '<html' || fail "UI not reachable at $BASE/"
curl -sf "$BASE/" | grep -qi 'CASPA Studio' && fail "Stale CASPA Studio shell detected"
ok "UI shell reachable"

node --input-type=module <<'EOF'
import puppeteer from 'puppeteer';

const base = process.env.CASPA_SMOKE_URL || 'http://127.0.0.1:3000';
const idea = `Smoke show ${Date.now()} — haunted Travelodge with a chorus that never leaves.`;

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const clickByText = async (page, pattern) => {
  const found = await page.evaluate((reSource) => {
    const re = new RegExp(reSource, 'i');
    const btn = Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent || ''));
    if (!btn) return false;
    btn.click();
    return true;
  }, pattern);
  if (!found) throw new Error(`button not found: /${pattern}/i`);
};

try {
  const page = await browser.newPage();
  await page.goto(base, { waitUntil: 'networkidle0', timeout: 60000 });

  await page.evaluate(() => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('caspa.') || k === 'caspa.localGuest')) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  });
  await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });

  const continueLocal = await page.waitForFunction(
    () => Array.from(document.querySelectorAll('button')).find((b) => /Continue locally/i.test(b.textContent || '')),
    { timeout: 20000 },
  ).catch(() => null);

  if (continueLocal) {
    await clickByText(page, 'Continue locally');
  }

  await page.waitForFunction(
    () => /What are we making\?/i.test(document.body?.innerText || ''),
    { timeout: 20000 },
  );

  await clickByText(page, 'Show in a Box');

  await page.waitForFunction(
    () => /Open Show in a Box/i.test(document.body?.innerText || ''),
    { timeout: 10000 },
  );

  await page.waitForSelector('textarea', { timeout: 15000 });
  await page.click('textarea', { clickCount: 3 });
  await page.type('textarea', idea);

  await clickByText(page, 'Open Show in a Box');

  await page.waitForFunction(
    () => /Show in a Box/i.test(document.body?.innerText || '') && /Song list|Running order|Music sketch/i.test(document.body?.innerText || ''),
    { timeout: 20000 },
  );

  const brief = await page.evaluate(() => localStorage.getItem('caspa.currentBrief'));
  if (!brief) throw new Error('caspa.currentBrief missing after show launch');
  if (!/musical/i.test(brief)) throw new Error('brief mode is not musical');

  // Seed a minimal pack so command-center + publish share live state.
  await page.evaluate(() => {
    localStorage.setItem(
      'caspa.showBox',
      JSON.stringify({
        songList: '1. Overture of Wrong Keys\n2. Room Service Lament\n3. Finale: Checkout Never Comes',
        runningOrder: 'I. Arrival\nII. Wrong room\nIII. Ensemble checkout',
        castNotes: 'Lead + doubles on chorus',
        productionPack: 'MD cue sheet + props: key cards',
        musicSketch: '126 BPM, D minor → F major, panto-rock',
        updatedAt: new Date().toISOString(),
      }),
    );
    localStorage.setItem(
      'caspa.manuscriptSource',
      'Chapter one.\n\nThe key card opened the wrong trauma, then the chorus answered from the lift.',
    );
  });

  // Next step / project home should show the unified command center.
  await clickByText(page, 'Next step|Project home|Home');
  await page.waitForFunction(
    () => /Show command center/i.test(document.body?.innerText || ''),
    { timeout: 15000 },
  );

  await clickByText(page, 'Draft book');
  await page.waitForFunction(
    () => /Just write|Open Workshop|chapter/i.test(document.body?.innerText || ''),
    { timeout: 15000 },
  );

  // Just write exposes Workshop; command-center station is only on Next step.
  const openedWorkshop = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const hit =
      buttons.find((b) => /Open Workshop/i.test(b.textContent || '')) ||
      buttons.find((b) => /^Workshop$/i.test((b.textContent || '').trim()));
    if (!hit) return false;
    hit.click();
    return true;
  });
  if (!openedWorkshop) {
    await clickByText(page, 'Next step');
    await page.waitForFunction(
      () => /Show command center/i.test(document.body?.innerText || ''),
      { timeout: 10000 },
    );
    await clickByText(page, 'Workshop');
  }

  await page.waitForFunction(
    () => /Diagnose|Commission|Inbox|Recommendations|Artefact/i.test(document.body?.innerText || ''),
    { timeout: 20000 },
  );

  // Publish is primary nav (always visible) — prefer exact label over Export pack station.
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const hit =
      buttons.find((b) => {
        const t = (b.textContent || '').replace(/\s+/g, ' ').trim();
        return /^Publish\b/i.test(t) || /Export when ready/i.test(t);
      }) ||
      buttons.find((b) => /Export pack/i.test(b.textContent || ''));
    if (!hit) throw new Error('Publish nav not found');
    hit.click();
  });

  await page.waitForFunction(
    () => /Show in a Box|show-pack|Export|Ready to publish|Pack/i.test(document.body?.innerText || ''),
    { timeout: 20000 },
  );

  const pack = await page.evaluate(() => localStorage.getItem('caspa.showBox'));
  if (!pack || !/Overture of Wrong Keys/.test(pack)) {
    throw new Error('show pack did not survive navigation');
  }

  console.log('OK: show spine pack → draft → workshop → publish (shared caspa.showBox)');
} finally {
  await browser.close();
}
EOF

ok "show spine"

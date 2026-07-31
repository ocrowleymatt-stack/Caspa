#!/usr/bin/env bash
# Local-first project persistence smoke — no Firebase, no server session.
# Requires a running Caspa server (CASPA_SMOKE_URL, default http://127.0.0.1:3000).
set -euo pipefail

BASE="${CASPA_SMOKE_URL:-http://127.0.0.1:3000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

fail() { echo "FAIL: $1"; exit 1; }
ok() { echo "OK: $1"; }

echo "Caspa local-project smoke against $BASE"

curl -sf "$BASE/" | grep -qi '<html' || fail "UI not reachable at $BASE/"
curl -sf "$BASE/" | grep -qi 'CASPA Studio' && fail "Stale CASPA Studio shell detected — redeploy Atlas to origin/main"
ok "UI shell is not the stale CASPA Studio build"

# Node + Puppeteer path: create a local project, reload, assert brief survives.
node --input-type=module <<'EOF'
import puppeteer from 'puppeteer';

const base = process.env.CASPA_SMOKE_URL || 'http://127.0.0.1:3000';
const idea = `Smoke manuscript ${Date.now()}`;

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.goto(base, { waitUntil: 'networkidle0', timeout: 60000 });

  // Clear any prior Caspa local state so the login gate appears.
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
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        /Continue locally/i.test(b.textContent || ''),
      );
      btn?.click();
    });
  }

  await page.waitForFunction(
    () => /What are we making\?/i.test(document.body?.innerText || ''),
    { timeout: 20000 },
  );

  // Fill idea and start writing (local-only — no session token).
  await page.waitForSelector('textarea', { timeout: 15000 });
  await page.click('textarea', { clickCount: 3 });
  await page.type('textarea', idea);

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      /Write it|Start writing|Open Design|Open Gold/i.test(b.textContent || ''),
    );
    if (!btn) throw new Error('Start button not found');
    btn.click();
  });

  await page.waitForFunction(
    () => {
      try {
        return Boolean(localStorage.getItem('caspa.currentBrief'));
      } catch {
        return false;
      }
    },
    { timeout: 15000 },
  );

  const before = await page.evaluate(() => ({
    brief: localStorage.getItem('caspa.currentBrief'),
    guest: localStorage.getItem('caspa.localGuest'),
    sessionKeys: Object.keys(localStorage).filter((k) => /session/i.test(k)),
  }));

  if (!before.brief) throw new Error('caspa.currentBrief missing after create');
  if (!before.brief.includes(idea.slice(0, 20))) throw new Error('brief did not persist idea text');
  if (before.sessionKeys.length) throw new Error(`unexpected session keys: ${before.sessionKeys.join(',')}`);

  // Import-style manuscript persistence without a server create session.
  await page.evaluate((text) => {
    localStorage.setItem('caspa.manuscriptSource', text);
  }, `Chapter one.\n\n${idea}`);

  await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });

  const after = await page.evaluate(() => ({
    brief: localStorage.getItem('caspa.currentBrief'),
    manuscript: localStorage.getItem('caspa.manuscriptSource'),
    guest: localStorage.getItem('caspa.localGuest'),
  }));

  if (!after.brief) throw new Error('brief lost after reload');
  if (!after.manuscript || !after.manuscript.includes(idea)) {
    throw new Error('manuscriptSource lost after reload');
  }

  console.log('OK: local project create + reload persistence (no Firebase session)');
} finally {
  await browser.close();
}
EOF

ok "local project persistence"

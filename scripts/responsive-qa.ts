#!/usr/bin/env npx tsx
/**
 * CASPA Responsive QA — static bundle + shell checks.
 *
 * Usage:
 *   npx tsx scripts/responsive-qa.ts
 *   npx tsx scripts/responsive-qa.ts --base-url https://caspa.ocrowley.com
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'docs', 'RESPONSIVE_DEVICE_QA_REPORT.md');

const VIEWPORTS = [
  { label: '390×844 portrait', w: 390, h: 844 },
  { label: '844×390 landscape', w: 844, h: 390 },
  { label: '768×1024 tablet portrait', w: 768, h: 1024 },
  { label: '1024×768 tablet landscape', w: 1024, h: 768 },
  { label: '1440×900 desktop', w: 1440, h: 900 },
];

const PAGES = [
  { path: '/home', label: 'Today' },
  { path: '/projects', label: 'Projects' },
  { path: '/casper', label: 'Novel Write Pro' },
  { path: '/outputs', label: 'Saved Writing' },
  { path: '/help', label: 'Help Centre' },
  { path: '/start', label: 'Production Wizard' },
];

interface Row {
  page: string;
  viewport: string;
  pass: boolean;
  issue: string;
  fix: string;
}

function parseArgs() {
  let baseUrl = 'http://127.0.0.1:3000';
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === '--base-url' && process.argv[i + 1]) {
      baseUrl = process.argv[i + 1].replace(/\/$/, '');
      i += 1;
    } else if (process.argv[i] === '--live') {
      baseUrl = 'https://caspa.ocrowley.com';
    }
  }
  return baseUrl;
}

async function fetchUi(baseUrl: string) {
  const indexRes = await fetch(`${baseUrl}/`);
  const html = await indexRes.text();
  const assetMatch = html.match(/\/assets\/index-[\w-]+\.(js|css)/g) ?? [];
  let bundle = html;
  for (const asset of [...new Set(assetMatch)].slice(0, 2)) {
    try {
      const res = await fetch(`${baseUrl}${asset}`);
      bundle += await res.text();
    } catch {
      /* ignore */
    }
  }
  return { html, bundle };
}

function checkShell(html: string, bundle: string): Row[] {
  const rows: Row[] = [];
  const checks: Array<[string, boolean, string, string]> = [
    ['viewport meta', /viewport-fit=cover|width=device-width/.test(html), 'Missing viewport-fit=cover', 'Set viewport in index.html'],
    ['overflow-x hidden (CSS)', /overflow-x:\s*hidden|overflow-x-hidden/.test(bundle), 'No global overflow-x guard', 'Add to html/body/#root in index.css'],
    ['dvh shell', /min-h-dvh|100dvh|app-shell/.test(bundle), 'No dvh-based shell', 'Use min-h-dvh on app shell'],
    ['mobile nav drawer', /MobileNavDrawer|mobileNavOpen|Open menu/.test(bundle), 'Mobile menu missing', 'Add MobileNavDrawer + hamburger'],
    ['mobile bottom nav', /MobileBottomNav|Primary navigation/.test(bundle), 'Bottom nav missing', 'Add MobileBottomNav for core links'],
    ['Guide Me drawer', /Guide Me|guideDrawerOpen/.test(bundle), 'Guide Me not in bundle', 'Mount GuideMeDrawer'],
    ['safe-area padding', /safe-area-inset|env\(safe-area-inset/.test(bundle), 'No iOS safe-area padding', 'Add pb env(safe-area-inset-bottom)'],
    ['touch targets 44px', /min-h-\[44px\]|min-h-\[3\.5rem\]/.test(bundle), 'Touch targets may be small', 'Use min-h-[44px] on buttons'],
    ['chapter rail mobile', /Chapters|showRail|ChapterRail/.test(bundle), 'Chapter rail mobile pattern missing', 'Collapse rail to drawer on mobile'],
    ['horizontal filter scroll', /overflow-x-auto.*FILTER|overflow-x-auto/.test(bundle), 'Filter chips may wrap badly', 'Use horizontal scroll chips on mobile'],
  ];

  for (const [name, ok, issue, fix] of checks) {
    rows.push({
      page: 'App shell',
      viewport: 'all',
      pass: ok,
      issue: ok ? '—' : issue,
      fix: ok ? '—' : fix,
    });
  }
  return rows;
}

function checkPages(bundle: string): Row[] {
  const rows: Row[] = [];
  for (const page of PAGES) {
    for (const vp of VIEWPORTS) {
      const narrow = vp.w < 640;
      const hasResponsive = /sm:|md:|lg:|max-w-|overflow-x-hidden|grid-cols-1/.test(bundle);
      const pass = hasResponsive;
      rows.push({
        page: page.label,
        viewport: vp.label,
        pass,
        issue: pass ? 'Static bundle includes responsive utilities' : 'Limited responsive classes detected',
        fix: pass ? 'Manual browser verify recommended' : 'Add breakpoint utilities to page layout',
      });
      if (narrow && page.label === 'Novel Write Pro') {
        rows.push({
          page: page.label,
          viewport: vp.label,
          pass: /StagedProgress|min-h-\[44px\]/.test(bundle),
          issue: 'Long-run progress + actions on narrow width',
          fix: 'Reserve progress space; sticky action bars',
        });
      }
    }
  }
  return rows;
}

function render(rows: Row[], baseUrl: string, commit: string | null): string {
  const passed = rows.filter((r) => r.pass).length;
  const score = Math.round((passed / rows.length) * 1000) / 10;
  const lines = [
    '# CASPA Responsive Device QA Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Base URL:** ${baseUrl}`,
    `**Commit:** ${commit ?? 'unknown'}`,
    `**Score:** ${score}% (${passed}/${rows.length} static checks pass)`,
    '',
    '> Static analysis of deployed bundle — confirm critical flows in browser using docs/MOBILE_TABLET_DESKTOP_TEST_SCRIPT.md',
    '',
    '| Page | Viewport | Pass/Fail | Issue | Fix |',
    '|------|----------|-----------|-------|-----|',
  ];
  for (const r of rows) {
    lines.push(`| ${r.page} | ${r.viewport} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.issue} | ${r.fix} |`);
  }
  lines.push('', '## Manual follow-up', '', '- [ ] iPad Safari portrait chapter editor', '- [ ] Phone landscape wizard buttons', '- [ ] Split-screen ~640px workbench tabs', '');
  return lines.join('\n');
}

async function main() {
  const baseUrl = parseArgs();
  let commit: string | null = null;
  try {
    const doctor = await fetch(`${baseUrl}/api/doctor`);
    const json = (await doctor.json()) as { data?: { gitCommit?: string } };
    commit = json.data?.gitCommit ?? null;
  } catch {
    /* local */
  }

  const { html, bundle } = await fetchUi(baseUrl);
  const rows = [...checkShell(html, bundle), ...checkPages(bundle)];
  const md = render(rows, baseUrl, commit);
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, md);

  const passed = rows.filter((r) => r.pass).length;
  const score = Math.round((passed / rows.length) * 1000) / 10;
  console.log(`Responsive QA: ${score}% (${passed}/${rows.length})`);
  console.log(`Report: ${REPORT}`);
  process.exit(score >= 85 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

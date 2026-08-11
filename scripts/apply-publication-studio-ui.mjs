import fs from 'node:fs';

const file = 'src/components/CaspaRedesign.tsx';
let src = fs.readFileSync(file, 'utf8');

src = src.replace("import { useMemo, useState } from 'react';", "import { useEffect, useMemo, useState } from 'react';");
src = src.replace("{ id: 'publish', label: 'Publish', detail: 'Export and readers', icon: Download },", "{ id: 'publish', label: 'Publication Studio', detail: 'Finish, adapt, QA and export', icon: Download },");

const oldPublish = `function PublishScreen({ title, computedWords }: { title: string; computedWords: number }) { return <SimpleScreen title=\"Publish\" text={\`${'${title}'} is at ${'${formatNumber(computedWords)}'} words. Export EPUB/PDF, create private links, and prep release metadata.\`} action=\"Generate export\" icon={ShieldCheck} />; }`;

const newPublish = `type PublicationStatus = {
  title?: string;
  status?: 'idle' | 'running' | 'attention' | 'complete';
  stage?: string;
  completedChapters?: number;
  totalChapters?: number;
  currentWords?: number;
  targetWords?: number;
  updatedAt?: string | null;
  failures?: number;
  output?: string | null;
};

function PublishScreen({ title, computedWords }: { title: string; computedWords: number }) {
  const [status, setStatus] = useState<PublicationStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const response = await fetch('/api/caspa/gold/publication-studio/status', { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(payload?.message || \`HTTP ${'${response.status}'}\`);
        if (alive) { setStatus(payload.data || null); setLoadError(null); }
      } catch (error: any) {
        if (alive) setLoadError(error?.message || 'Progress unavailable');
      }
    };
    poll();
    const timer = window.setInterval(poll, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const current = Number(status?.currentWords || computedWords || 0);
  const target = Number(status?.targetWords || 0);
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const chapterText = status?.totalChapters
    ? \`${'${status.completedChapters || 0}'} / ${'${status.totalChapters}'} chapters\`
    : 'Project-level workflow';
  const heartbeat = status?.updatedAt ? new Date(status.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'not yet reported';
  const stateLabel = status?.status === 'complete' ? 'Complete' : status?.status === 'attention' ? 'Needs attention' : status?.status === 'running' ? 'Working' : 'Ready';

  return (
    <section className=\"cs-page\">
      <div className=\"cs-hero cs-hero--compact\">
        <div><div className=\"cs-kicker\">Publication Studio</div><h1>{title}</h1><p>One place to finish, adapt, quality-check, repair and export long-form work.</p></div>
        <ShieldCheck size={32} />
      </div>
      <div className=\"cs-grid\" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', alignItems: 'start' }}>
        <article className=\"cs-card cs-card--large\">
          <div className=\"cs-card__title\">Current long-form job <span>{stateLabel}</span></div>
          <h2 style={{ margin: '0 0 0.35rem' }}>{status?.title || 'Publication workflow'}</h2>
          <p style={{ marginTop: 0, opacity: 0.8 }}>{status?.stage || 'No active background stage'}</p>
          <div className=\"cs-progress-bar\"><span style={{ width: \`${'${percent}'}%\` }} /></div>
          <div className=\"cs-stat-row\" style={{ marginTop: '1rem' }}>
            <Metric value={target ? \`${'${formatNumber(current)}'} / ${'${formatNumber(target)}'}\` : formatNumber(current)} label=\"Words\" />
            <Metric value={chapterText} label=\"Progress\" />
            <Metric value={status?.failures || 0} label=\"Issues retained\" />
            <Metric value={heartbeat} label=\"Last checkpoint\" />
          </div>
          {loadError && <p style={{ marginTop: '1rem' }}>Progress feed temporarily unavailable: {loadError}</p>}
          <p style={{ marginBottom: 0, marginTop: '1rem' }}>Background work is checkpointed. Closing this page does not cancel a server-side publication job.</p>
        </article>
        <aside className=\"cs-card\">
          <div className=\"cs-card__title\">Publication actions</div>
          <p><strong>Develop</strong><br/>Expand, restructure or adapt a manuscript for a new audience.</p>
          <p><strong>Quality</strong><br/>Run factual, citation, continuity and publication-readiness checks.</p>
          <p><strong>Repair & resume</strong><br/>Continue from the last valid checkpoint instead of restarting the book.</p>
          <p><strong>Export</strong><br/>Prepare the finished manuscript for PDF, EPUB and release packaging.</p>
          <button className=\"cs-button cs-button--gold\" disabled={status?.status === 'running'}>{status?.status === 'running' ? 'Job running' : 'Start publication job'}</button>
        </aside>
      </div>
    </section>
  );
}`;

if (src.includes(oldPublish)) {
  src = src.replace(oldPublish, newPublish);
} else if (!src.includes('type PublicationStatus = {')) {
  throw new Error('Could not locate legacy PublishScreen; refusing unsafe patch');
}

fs.writeFileSync(file, src);
console.log('Publication Studio UI consolidation applied');

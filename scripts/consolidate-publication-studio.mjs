import fs from 'node:fs';

const file = 'src/components/CaspaRedesign.tsx';
let s = fs.readFileSync(file, 'utf8');

function mustReplace(from, to, label) {
  if (!s.includes(from)) throw new Error(`Could not find ${label}`);
  s = s.replace(from, to);
}

mustReplace("import { useMemo, useState } from 'react';", "import { useEffect, useMemo, useState } from 'react';", 'React import');
mustReplace("{ id: 'publish', label: 'Publish', detail: 'Export and readers', icon: Download },", "{ id: 'publish', label: 'Publication Studio', detail: 'Adapt, finish, QA and export', icon: Download },", 'Publish navigation item');

mustReplace(
  "  const [assistantResult, setAssistantResult] = useState<string | null>(null);",
  "  const [assistantResult, setAssistantResult] = useState<string | null>(null);\n  const [publicationStatus, setPublicationStatus] = useState<any>(null);\n  const [publicationStatusError, setPublicationStatusError] = useState<string | null>(null);",
  'assistant state'
);

const effectBlock = [
  "  useEffect(() => {",
  "    let cancelled = false;",
  "    const load = async () => {",
  "      try {",
  "        const response = await fetch('/api/caspa/gold/publication-studio/progress', { cache: 'no-store' });",
  "        const payload = await response.json();",
  "        if (!response.ok || payload?.success === false) throw new Error(payload?.message || ('HTTP ' + response.status));",
  "        if (!cancelled) {",
  "          setPublicationStatus(payload?.data || payload);",
  "          setPublicationStatusError(null);",
  "        }",
  "      } catch (error: any) {",
  "        if (!cancelled) setPublicationStatusError(error?.message || 'Progress unavailable');",
  "      }",
  "    };",
  "    load();",
  "    const timer = window.setInterval(load, 5000);",
  "    return () => { cancelled = true; window.clearInterval(timer); };",
  "  }, []);",
  "",
  "  const callAssistant = async (action: string, content?: string) => {"
].join('\n');

mustReplace(
  "  const callAssistant = async (action: string, content?: string) => {",
  effectBlock,
  'assistant function'
);

mustReplace(
  "      case 'publish':\n        return <PublishScreen title={projectTitle} computedWords={computedWords} />;",
  "      case 'publish':\n        return <PublicationStudioScreen title={projectTitle} computedWords={computedWords} status={publicationStatus} statusError={publicationStatusError} />;",
  'publish case'
);

mustReplace(
  "  }, [props.currentView, projectTitle, genre, selectedChapter, chapters, characters, progress, computedWords, assistantLoading, assistantResult]);",
  "  }, [props.currentView, projectTitle, genre, selectedChapter, chapters, characters, progress, computedWords, assistantLoading, assistantResult, publicationStatus, publicationStatusError]);",
  'memo dependencies'
);

const publicationScreen = [
  "function PublicationStudioScreen({ title, computedWords, status, statusError }: { title: string; computedWords: number; status: any; statusError: string | null }) {",
  "  const job = status?.active || status?.job || status;",
  "  const currentWords = Number(job?.currentWords ?? job?.wordCount ?? computedWords ?? 0);",
  "  const targetWords = Number(job?.targetWords ?? job?.targetWordCount ?? 0);",
  "  const completed = Number(job?.chaptersCompleted ?? job?.completedChapters ?? job?.chapter ?? 0);",
  "  const total = Number(job?.chaptersTotal ?? job?.totalChapters ?? 0);",
  "  const stage = String(job?.stage || job?.status || 'Ready');",
  "  const pct = targetWords > 0 ? Math.min(100, Math.round((currentWords / targetWords) * 100)) : 0;",
  "  const updated = job?.updatedAt || job?.heartbeatAt || status?.updatedAt;",
  "  return (",
  "    <section className=\"cs-page\">",
  "      <div className=\"cs-hero cs-hero--compact\"><div><div className=\"cs-kicker\">Publication Studio</div><h1>{title}</h1><p>One place to adapt, finish, quality-check, recover and export long-form work.</p></div><ShieldCheck size={34} /></div>",
  "      <div className=\"cs-grid\">",
  "        <article className=\"cs-card cs-card--large\">",
  "          <div className=\"cs-card__title\">Current long-form job</div>",
  "          {statusError && !status ? <p>Live progress is temporarily unavailable: {statusError}</p> : <>",
  "            <div className=\"cs-stat-row\">",
  "              <Metric value={stage} label=\"Stage\" />",
  "              <Metric value={total ? (completed + '/' + total) : (completed || '—')} label=\"Chapters\" />",
  "              <Metric value={formatNumber(currentWords)} label=\"Words\" />",
  "              <Metric value={targetWords ? formatNumber(targetWords) : '—'} label=\"Target\" />",
  "            </div>",
  "            {targetWords > 0 && <><div className=\"cs-progress-bar\"><span style={{ width: pct + '%' }} /></div><p>{pct}% of target word count.</p></>}",
  "            <p>{updated ? ('Last checkpoint: ' + new Date(updated).toLocaleString('en-GB')) : 'Waiting for a persisted checkpoint.'}</p>",
  "          </>}",
  "        </article>",
  "        <article className=\"cs-card\">",
  "          <div className=\"cs-card__title\">Publication workflow</div>",
  "          <p><strong>Create or adapt</strong> → develop → QA/repair → design/illustrate → export.</p>",
  "          <p>Gold, Finish, repair and recovery remain internal capabilities; you do not need to hunt for separate engines.</p>",
  "        </article>",
  "        <article className=\"cs-card\">",
  "          <div className=\"cs-card__title\">Manuscript</div>",
  "          <p>{formatNumber(computedWords)} words currently loaded in this project.</p>",
  "          <button className=\"cs-button cs-button--gold\">Continue / Resume</button>",
  "        </article>",
  "      </div>",
  "    </section>",
  "  );",
  "}"
].join('\n');

mustReplace(
  "function PublishScreen({ title, computedWords }: { title: string; computedWords: number }) { return <SimpleScreen title=\"Publish\" text={`${title} is at ${formatNumber(computedWords)} words. Export EPUB/PDF, create private links, and prep release metadata.`} action=\"Generate export\" icon={ShieldCheck} />; }",
  publicationScreen,
  'PublishScreen'
);

fs.writeFileSync(file, s);
console.log('Publication Studio UI consolidation applied');

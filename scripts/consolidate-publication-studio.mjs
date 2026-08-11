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
  "  const [assistantResult, setAssistantResult] = useState<string | null>(null);\n  const [publicationStatus, setPublicationStatus] = useState<any>(null);\n  const [publicationStatusError, setPublicationStatusError] = useState<string | null>(null);"
, 'assistant state');

mustReplace(
  "  const callAssistant = async (action: string, content?: string) => {",
  `  useEffect(() => {\n    let cancelled = false;\n    const load = async () => {\n      try {\n        const response = await fetch('/api/caspa/gold/publication-studio/progress', { cache: 'no-store' });\n        const payload = await response.json();\n        if (!response.ok || payload?.success === false) throw new Error(payload?.message || \\`HTTP \\${response.status}\\`);\n        if (!cancelled) {\n          setPublicationStatus(payload?.data || payload);\n          setPublicationStatusError(null);\n        }\n      } catch (error: any) {\n        if (!cancelled) setPublicationStatusError(error?.message || 'Progress unavailable');\n      }\n    };\n    load();\n    const timer = window.setInterval(load, 5000);\n    return () => { cancelled = true; window.clearInterval(timer); };\n  }, []);\n\n  const callAssistant = async (action: string, content?: string) => {`
, 'assistant function');

mustReplace(
  "      case 'publish':\n        return <PublishScreen title={projectTitle} computedWords={computedWords} />;",
  "      case 'publish':\n        return <PublicationStudioScreen title={projectTitle} computedWords={computedWords} status={publicationStatus} statusError={publicationStatusError} />;"
, 'publish case');

mustReplace(
  "  }, [props.currentView, projectTitle, genre, selectedChapter, chapters, characters, progress, computedWords, assistantLoading, assistantResult]);",
  "  }, [props.currentView, projectTitle, genre, selectedChapter, chapters, characters, progress, computedWords, assistantLoading, assistantResult, publicationStatus, publicationStatusError]);"
, 'memo dependencies');

mustReplace(
  "function PublishScreen({ title, computedWords }: { title: string; computedWords: number }) { return <SimpleScreen title=\"Publish\" text={`${title} is at ${formatNumber(computedWords)} words. Export EPUB/PDF, create private links, and prep release metadata.`} action=\"Generate export\" icon={ShieldCheck} />; }",
  `function PublicationStudioScreen({ title, computedWords, status, statusError }: { title: string; computedWords: number; status: any; statusError: string | null }) {\n  const job = status?.active || status?.job || status;\n  const currentWords = Number(job?.currentWords ?? job?.wordCount ?? computedWords ?? 0);\n  const targetWords = Number(job?.targetWords ?? job?.targetWordCount ?? 0);\n  const completed = Number(job?.chaptersCompleted ?? job?.completedChapters ?? job?.chapter ?? 0);\n  const total = Number(job?.chaptersTotal ?? job?.totalChapters ?? 0);\n  const stage = String(job?.stage || job?.status || 'Ready');\n  const pct = targetWords > 0 ? Math.min(100, Math.round((currentWords / targetWords) * 100)) : 0;\n  const updated = job?.updatedAt || job?.heartbeatAt || status?.updatedAt;\n  return (\n    <section className=\"cs-page\">\n      <div className=\"cs-hero cs-hero--compact\"><div><div className=\"cs-kicker\">Publication Studio</div><h1>{title}</h1><p>One place to adapt, finish, quality-check, recover and export long-form work.</p></div><ShieldCheck size={34} /></div>\n      <div className=\"cs-grid\">\n        <article className=\"cs-card cs-card--large\">\n          <div className=\"cs-card__title\">Current long-form job</div>\n          {statusError && !status ? <p>Live progress is temporarily unavailable: {statusError}</p> : <>\n            <div className=\"cs-stat-row\">\n              <Metric value={stage} label=\"Stage\" />\n              <Metric value={total ? \\`\\${completed}/\\${total}\\` : completed || '—'} label=\"Chapters\" />\n              <Metric value={formatNumber(currentWords)} label=\"Words\" />\n              <Metric value={targetWords ? formatNumber(targetWords) : '—'} label=\"Target\" />\n            </div>\n            {targetWords > 0 && <><div className=\"cs-progress-bar\"><span style={{ width: \\`\\${pct}%\\` }} /></div><p>{pct}% of target word count.</p></>}\n            <p>{updated ? \\`Last checkpoint: \\${new Date(updated).toLocaleString('en-GB')}\\` : 'Waiting for a persisted checkpoint.'}</p>\n          </>}\n        </article>\n        <article className=\"cs-card\">\n          <div className=\"cs-card__title\">Publication workflow</div>\n          <p><strong>Create or adapt</strong> → develop → QA/repair → design/illustrate → export.</p>\n          <p>Gold, Finish, repair and recovery remain internal capabilities; you do not need to hunt for separate engines.</p>\n        </article>\n        <article className=\"cs-card\">\n          <div className=\"cs-card__title\">Manuscript</div>\n          <p>{formatNumber(computedWords)} words currently loaded in this project.</p>\n          <button className=\"cs-button cs-button--gold\">Continue / Resume</button>\n        </article>\n      </div>\n    </section>\n  );\n}`
, 'PublishScreen');

fs.writeFileSync(file, s);
console.log('Publication Studio UI consolidation applied');

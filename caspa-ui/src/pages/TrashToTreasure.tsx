import { FormEvent, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Gem, Sparkles, UploadCloud } from 'lucide-react';
import { trashToTreasure, exportMarkdownManuscript } from '../api/book';
import { listProjects } from '../api/projects';
import { useAppStore } from '../store';
import { useToast } from '../components/Toast';
import {
  StagedProgressPanel,
} from '../components/StagedProgressPanel';
import { TRASH_TO_TREASURE_STAGES } from '../components/StagedProgress';
import { isSupportedManuscriptFile, readManuscriptFile } from '../lib/manuscriptUpload';

const OUTCOMES = [
  { id: 'fix', label: 'Make it coherent', hint: 'Untangle structure and voice' },
  { id: 'make commercial', label: 'Make it commercial', hint: 'Sharpen hook and market shape' },
  { id: 'make literary', label: 'Make it literary', hint: 'Deepen texture and ambition' },
  { id: 'make funnier', label: 'Make it funnier', hint: 'Find the comic engine' },
  { id: 'make darker', label: 'Make it darker', hint: 'Raise stakes and shadow' },
  { id: 'make stageable', label: 'Make it stageable', hint: 'Scene, dialogue, production' },
  { id: 'finish', label: 'Finish the book', hint: 'Roadmap to a complete manuscript' },
  { id: 'rescue', label: 'Rescue only the best idea', hint: 'Keep the gold, cut the rest' },
] as const;

type Step = 1 | 2 | 3 | 4;

export default function TrashToTreasure() {
  const toast = useToast();
  const { id: routeProjectId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get('projectId')?.trim() ?? '';
  const projectId = routeProjectId ?? queryProjectId;
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);

  const [step, setStep] = useState<Step>(1);
  const [material, setMaterial] = useState('');
  const [problem, setProblem] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState<string>('fix');
  const [tone, setTone] = useState('Warm, vivid, production-minded');
  const [title, setTitle] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const rescueMutation = useMutation({
    mutationFn: () =>
      trashToTreasure({
        projectId: projectId || undefined,
        title: title.trim() || undefined,
        material,
        problem: problem.trim() || undefined,
        desiredOutcome,
        tone,
      }),
    onSuccess: (data) => {
      setResult(data);
      setStep(4);
      const pid = String(data.projectId ?? projectId ?? '');
      if (pid) setActiveProjectId(pid);
      toast.success('Rough material rescued — nothing overwritten.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isSupportedManuscriptFile(file)) {
      toast.error('Use .txt, .md, .rtf or .html — or paste directly.');
      event.target.value = '';
      return;
    }
    const { text } = await readManuscriptFile(file);
    setMaterial(text);
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
    toast.success('Material loaded — original preserved until you save a rescue.');
    event.target.value = '';
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === 1 && material.trim().length < 40) {
      toast.error('Paste at least a paragraph of rough material.');
      return;
    }
    if (step < 3) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    rescueMutation.mutate();
  }

  const outputId = result?.outputId ? String(result.outputId) : undefined;
  const rescuedProjectId = result?.projectId ? String(result.projectId) : projectId;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#dfc991] bg-[#fffaf0] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#98711d]">
          <Gem className="h-4 w-4" /> Trash to Treasure
        </div>
        <h1 className="font-serif text-5xl font-semibold leading-[0.95] tracking-[-0.04em] text-[#171a22] md:text-6xl">
          Fix / Finish a Bad Project
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-muted">
          This has bones. Paste rough material — CASPA diagnoses problems, finds the strongest premise, and saves a rescue plan.{' '}
          <strong className="text-[#171a22]">Nothing has been overwritten.</strong>
        </p>
        {projectId && (
          <p className="text-sm text-[#766b58]">
            Rescuing inside project: {projects.find((p) => p.id === projectId)?.title ?? projectId.slice(0, 8)}
          </p>
        )}
      </header>

      {step < 4 && (
        <div className="flex gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">
          {(['Paste', 'Diagnose', 'Rescue'] as const).map((label, i) => (
            <span
              key={label}
              className={`rounded-full px-3 py-1 ${step === i + 1 ? 'bg-[#fff1c9] text-[#171a22]' : 'text-[#b8aa91]'}`}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>
      )}

      {step === 1 && (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper md:p-8">
          <label className="block text-sm">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Rough material</span>
            <textarea
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              rows={14}
              className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-5 font-serif text-lg leading-8 outline-none focus:border-[#caa044]"
              placeholder="Paste fragments, a weak draft, repeated scenes, notes — anything with potential."
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="btn-secondary cursor-pointer">
              <UploadCloud className="h-4 w-4" /> Upload file
              <input type="file" accept=".txt,.md,.markdown,.rtf,.html,.htm" className="hidden" onChange={handleUpload} />
            </label>
            {!projectId && (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Project title (optional)"
                className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-2 text-sm outline-none focus:border-[#caa044]"
              />
            )}
          </div>
          <button type="submit" className="btn-primary">
            Next — what feels wrong? <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper md:p-8">
          <label className="block text-sm">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">What feels wrong?</span>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4 text-sm leading-7 outline-none focus:border-[#caa044]"
              placeholder="Too many beginnings? No ending? Wrong tone? Lost thread? Tell CASPA in plain language."
            />
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="btn-secondary">Back</button>
            <button type="submit" className="btn-primary">Next — choose outcome</button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper md:p-8">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Desired outcome</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {OUTCOMES.map((outcome) => (
              <button
                key={outcome.id}
                type="button"
                onClick={() => setDesiredOutcome(outcome.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  desiredOutcome === outcome.id
                    ? 'border-[#caa044] bg-[#fff8e8]'
                    : 'border-[#eadfca] bg-[#fffdf8] hover:border-[#caa044]'
                }`}
              >
                <div className="font-semibold text-[#171a22]">{outcome.label}</div>
                <div className="mt-1 text-xs text-muted">{outcome.hint}</div>
              </button>
            ))}
          </div>
          <label className="block text-sm">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Tone (optional)</span>
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#caa044]"
            />
          </label>

          <StagedProgressPanel
            label="Trash to Treasure rescue"
            stages={TRASH_TO_TREASURE_STAGES}
            pending={rescueMutation.isPending}
            error={rescueMutation.isError ? rescueMutation.error.message : null}
            outputId={outputId}
          />

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="btn-secondary" disabled={rescueMutation.isPending}>
              Back
            </button>
            <button type="submit" className="btn-primary" disabled={rescueMutation.isPending}>
              {rescueMutation.isPending ? 'Rescuing…' : 'Rescue this material'}
            </button>
          </div>
        </form>
      )}

      {step === 4 && result && (
        <section className="space-y-6 rounded-[2rem] border border-emerald-200 bg-emerald-50/50 p-6 md:p-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Rescue complete</div>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-[#171a22]">Here is the strongest version of what this could become.</h2>
            <p className="mt-2 text-sm text-emerald-900">Nothing has been overwritten. Original material preserved.</p>
          </div>

          {typeof result.diagnosis === 'string' && (
            <div className="rounded-2xl border border-[#eadfca] bg-white p-5">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Diagnosis</div>
              <p className="mt-2 text-sm leading-7 text-[#5f5648]">{result.diagnosis}</p>
            </div>
          )}

          {Array.isArray(result.rescuePlan) && (
            <div className="rounded-2xl border border-[#eadfca] bg-white p-5">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Rescue plan</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#5f5648]">
                {(result.rescuePlan as string[]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {typeof result.rewrite === 'string' && result.rewrite.trim() && (
            <div className="rounded-2xl border border-[#eadfca] bg-white p-5">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Rewrite sample</div>
              <p className="mt-2 whitespace-pre-wrap font-serif text-base leading-8 text-[#2a2520]">{result.rewrite}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {outputId && (
              <Link to={`/outputs/${outputId}`} className="btn-primary">
                <Sparkles className="h-4 w-4" /> Open Writing History
              </Link>
            )}
            {rescuedProjectId && (
              <>
                <Link to={`/projects/${rescuedProjectId}`} className="btn-secondary">Continue from this</Link>
                <Link to={`/projects/${rescuedProjectId}/gold`} className="btn-secondary">Run Gold Pass</Link>
                <Link to={`/projects/${rescuedProjectId}/book-map`} className="btn-secondary">Book Map</Link>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={async () => {
                    const { markdown } = await exportMarkdownManuscript(rescuedProjectId);
                    await navigator.clipboard.writeText(markdown);
                    toast.success('Markdown copied');
                  }}
                >
                  Export Markdown
                </button>
              </>
            )}
            <Link to="/home" className="btn-ghost text-sm">Back to Today</Link>
          </div>
          <p className="text-xs text-muted">DOCX export: use project Export tab. PDF: coming next on export page.</p>
        </section>
      )}
    </div>
  );
}

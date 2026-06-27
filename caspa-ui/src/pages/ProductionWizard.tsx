import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Sparkles } from 'lucide-react';
import { listProjects } from '../api/projects';
import {
  generateProductionBrief,
  getProductionBrief,
  listProjectAssets,
  patchIntimacySettings,
  patchProductionBrief,
  type HeatLevel,
  type ProductType,
} from '../api/studio';
import { useAppStore } from '../store';
import { useToast } from '../components/Toast';

const PRODUCT_TYPES: Array<{ id: ProductType; label: string; hint: string }> = [
  { id: 'novel', label: 'Novel', hint: 'Long-form fiction with chapters' },
  { id: 'memoir', label: 'Memoir', hint: 'Personal narrative, true voice' },
  { id: 'short-story', label: 'Short story', hint: 'Single arc, tight scope' },
  { id: 'stage-play', label: 'Stage play', hint: 'Scenes, dialogue, production' },
  { id: 'screenplay', label: 'Screenplay', hint: 'Visual beats and slug lines' },
  { id: 'musical', label: 'Musical', hint: 'Book + lyrics + numbers' },
  { id: 'comedy-sketch', label: 'Comedy sketch', hint: 'Short comic set-piece' },
  { id: 'childrens-story', label: "Children's story", hint: 'Age-appropriate tone' },
  { id: 'poetry-collection', label: 'Poetry collection', hint: 'Linked or themed poems' },
  { id: 'nonfiction-book', label: 'Nonfiction book', hint: 'Argument or expertise' },
  { id: 'essay', label: 'Essay', hint: 'Focused long-form piece' },
  { id: 'pitch-deck', label: 'Pitch deck copy', hint: 'Hook, market, sample' },
  { id: 'treatment', label: 'Treatment', hint: 'Story bible for buyers' },
  { id: 'project-bible', label: 'Project Bible', hint: 'Premise, world, plan only' },
  { id: 'book-map', label: 'Book Map', hint: 'Structure and finish roadmap' },
  { id: 'submission-package', label: 'Submission package', hint: 'Query + sample + synopsis' },
  { id: 'research-dossier', label: 'Research dossier', hint: 'Organised source pack' },
  { id: 'evidence-report', label: 'Evidence-style report', hint: 'Claims with support' },
  { id: 'marketing-pack', label: 'Marketing pack', hint: 'Blurbs, hooks, copy' },
  { id: 'show-in-a-box', label: 'Show-in-a-Box', hint: 'Complete show package' },
  { id: 'educational-resource', label: 'Educational resource', hint: 'Teaching material' },
  { id: 'custom', label: 'Custom product', hint: 'Define your own finish line' },
];

const HEAT_OPTIONS: Array<{ level: HeatLevel; label: string; desc: string }> = [
  { level: 0, label: 'No adult scenes', desc: 'No sexual content; clean romance only if any.' },
  { level: 1, label: 'Romantic tension only', desc: 'Flirtation and longing — no sex.' },
  { level: 2, label: 'Fade to black', desc: 'Build-up allowed; cuts before intimacy.' },
  { level: 3, label: 'Sensual, not graphic', desc: 'Adult intimacy, literary and emotional.' },
  { level: 4, label: 'Spicy adult romance', desc: 'Stronger heat; consensual, character-led.' },
  { level: 5, label: 'Explicit adult fiction', desc: 'Adult-only; explicit when requested.' },
];

type Step = 1 | 2 | 3 | 4;

export default function ProductionWizard() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const projectId = searchParams.get('projectId')?.trim() || activeProjectId || '';

  const [step, setStep] = useState<Step>(1);
  const [productType, setProductType] = useState<ProductType>('novel');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [targetLength, setTargetLength] = useState('');
  const [successCriteria, setSuccessCriteria] = useState('');
  const [heatLevel, setHeatLevel] = useState<HeatLevel>(0);
  const [askBeforeHeat, setAskBeforeHeat] = useState(true);

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: listProjects });
  const { data: assets = [] } = useQuery({
    queryKey: ['project-assets', projectId],
    queryFn: () => listProjectAssets(projectId),
    enabled: !!projectId,
  });
  const { data: brief } = useQuery({
    queryKey: ['production-brief', projectId],
    queryFn: () => getProductionBrief(projectId),
    enabled: !!projectId,
  });

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Select a project first.');
      await patchProductionBrief(projectId, {
        productType,
        audience: audience.trim() || undefined,
        tone: tone.trim() || undefined,
        targetLength: targetLength ? Number(targetLength) : undefined,
        successCriteria: successCriteria.trim() || undefined,
        sourceAssets: assets.map((a) => a.id),
        exportTargets: ['markdown', 'docx'],
        privacyMode: 'local-first',
      });
      await patchIntimacySettings(projectId, {
        enabled: heatLevel > 0,
        defaultHeatLevel: heatLevel,
        adultOnly: heatLevel >= 5,
        askBeforeIncreasingHeat: askBeforeHeat,
        clarificationMode: askBeforeHeat ? 'always-ask' : 'ambiguous-only',
      });
      return generateProductionBrief(projectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-brief', projectId] });
      queryClient.invalidateQueries({ queryKey: ['guide-state', projectId] });
      toast.success('Production Brief saved — CASPA knows what finished means.');
      setStep(4);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === 1 && !projectId) {
      toast.error('Pick a project from Projects first, or open this wizard from a project.');
      return;
    }
    if (step < 3) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    saveMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rounded-[2rem] border border-[#eadfca] bg-white p-8 shadow-room">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#dfc991] bg-[#fffaf0] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#98711d]">
          <Sparkles className="h-4 w-4" /> Production Wizard
        </div>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] text-[#171a22]">
          What do you want CASPA to make?
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Optional, skippable, resumable — defines audience, tone, length, and success criteria before heavy generation.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/home" className="btn-ghost text-xs">Skip for now</Link>
          {projectId && (
            <Link to={`/projects/${projectId}`} className="btn-ghost text-xs">Back to project</Link>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="rounded-[2rem] border border-[#eadfca] bg-[#fffdf8] p-8 shadow-paper">
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Step 1 · Project</div>
            {selectedProject ? (
              <p className="text-sm">
                Working in <strong>{selectedProject.title}</strong> · {assets.length} source asset(s)
              </p>
            ) : (
              <p className="text-sm text-muted">
                Open a project first, then return here — or add <code>?projectId=…</code> to the URL.
              </p>
            )}
            <Link to="/projects" className="btn-secondary inline-flex">Choose project</Link>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Step 2 · Product type</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRODUCT_TYPES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProductType(p.id)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                    productType === p.id
                      ? 'border-[#171a22] bg-[#171a22] text-white'
                      : 'border-[#eadfca] bg-white hover:border-[#caa044]'
                  }`}
                >
                  <div className="font-semibold">{p.label}</div>
                  <div className={`text-xs ${productType === p.id ? 'text-white/70' : 'text-muted'}`}>{p.hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Step 3 · Brief &amp; intimacy</div>
            <label className="block text-sm">
              Audience
              <input value={audience} onChange={(e) => setAudience(e.target.value)} className="input mt-1" placeholder="Who is this for?" />
            </label>
            <label className="block text-sm">
              Tone
              <input value={tone} onChange={(e) => setTone(e.target.value)} className="input mt-1" placeholder="Warm, literary, commercial…" />
            </label>
            <label className="block text-sm">
              Target length (words, optional)
              <input value={targetLength} onChange={(e) => setTargetLength(e.target.value)} className="input mt-1" type="number" min={0} />
            </label>
            <label className="block text-sm">
              What does finished look like?
              <textarea
                value={successCriteria}
                onChange={(e) => setSuccessCriteria(e.target.value)}
                className="input mt-1 min-h-[80px]"
                placeholder="Award-ready draft, submission package, full book map…"
              />
            </label>

            <fieldset className="space-y-3 rounded-xl border border-[#eadfca] bg-white p-4">
              <legend className="px-1 text-sm font-semibold text-[#171a22]">
                Will this work include romance, intimacy, or adult sex scenes?
              </legend>
              {HEAT_OPTIONS.map((opt) => (
                <label key={opt.level} className="flex cursor-pointer gap-3 text-sm">
                  <input
                    type="radio"
                    name="heat"
                    checked={heatLevel === opt.level}
                    onChange={() => setHeatLevel(opt.level)}
                  />
                  <span>
                    <strong>{opt.label}</strong> — {opt.desc}
                  </span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={askBeforeHeat} onChange={(e) => setAskBeforeHeat(e.target.checked)} />
                Ask before increasing heat level
              </label>
            </fieldset>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Production Brief ready</div>
            <p className="font-serif text-2xl text-[#171a22]">CASPA knows what you are making.</p>
            {brief?.successCriteria && (
              <p className="text-sm text-muted">{brief.successCriteria}</p>
            )}
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              {projectId && (
                <>
                  <Link to={`/projects/${projectId}/bible`} className="btn-primary">
                    Generate Project Bible <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to={`/projects/${projectId}/sources`} className="btn-secondary">Source Library</Link>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate(`/projects/${projectId}`)}
                  >
                    Project overview
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {step < 4 && (
          <div className="mt-8 flex justify-between">
            <button
              type="button"
              className="btn-ghost"
              disabled={step === 1}
              onClick={() => setStep((s) => (s - 1) as Step)}
            >
              Back
            </button>
            <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
              {step === 3 ? (saveMutation.isPending ? 'Generating…' : 'Save & generate brief') : 'Continue'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

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
  type CreativeTarget,
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

const READER_EFFECTS = [
  'gripped', 'moved', 'amused', 'unsettled', 'disturbed', 'haunted', 'heartbroken',
  'hopeful', 'furious', 'seduced', 'shocked', 'cathartic', 'intellectually impressed',
  'emotionally wrecked', 'morally uneasy', 'exhilarated',
] as const;

const AFTERTASTE_OPTIONS = [
  'clean closure', 'bittersweet', 'dread', 'wonder', 'ache', 'comic release',
  'moral unease', 'triumph', 'ambiguity', 'shock',
] as const;

const LENGTH_PRESETS: Array<{ id: string; label: string; words: number; chapters?: number }> = [
  { id: 'short-piece', label: 'Short piece', words: 3000 },
  { id: 'short-story', label: 'Short story', words: 7500 },
  { id: 'novella', label: 'Novella', words: 35000, chapters: 12 },
  { id: 'short-novel', label: 'Short novel', words: 55000, chapters: 18 },
  { id: 'full-novel', label: 'Full novel', words: 80000, chapters: 24 },
  { id: 'long-novel', label: 'Long novel', words: 110000, chapters: 32 },
  { id: 'one-act', label: 'One-act play', words: 12000, chapters: 8 },
  { id: 'full-play', label: 'Full-length play', words: 25000, chapters: 16 },
  { id: 'short-musical', label: 'Short musical', words: 18000, chapters: 14 },
  { id: 'full-musical', label: 'Full musical', words: 35000, chapters: 22 },
];

const AVOID_OPTIONS = [
  'cliché', 'sentimentality', 'melodrama', 'purple prose', 'flat dialogue', 'generic AI voice',
  'over-explaining', 'moralising', 'cheap shock', 'gratuitous sex', 'gratuitous violence',
  'blandness', 'confusing structure', 'losing source truth',
];

const OPTIMIZE_OPTIONS = [
  'readability', 'beauty', 'pace', 'comedy', 'darkness', 'stageability', 'psychological force',
  'commercial appeal', 'literary originality', 'award-worthiness', 'emotional devastation',
  'clarity', 'accessibility',
];

type Step = 1 | 2 | 3 | 4 | 5;

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
  const [successCriteria, setSuccessCriteria] = useState('');
  const [heatLevel, setHeatLevel] = useState<HeatLevel>(0);
  const [askBeforeHeat, setAskBeforeHeat] = useState(true);
  const [readerEffects, setReaderEffects] = useState<string[]>([]);
  const [aftertaste, setAftertaste] = useState('');
  const [audienceAfterthought, setAudienceAfterthought] = useState('');
  const [intensity, setIntensity] = useState(4);
  const [literaryBalance, setLiteraryBalance] = useState<CreativeTarget['literaryBalance']>('commercial-intelligent');
  const [lengthPreset, setLengthPreset] = useState('full-novel');
  const [customWordCount, setCustomWordCount] = useState('');
  const [targetChapterCount, setTargetChapterCount] = useState('');
  const [optimizeFor, setOptimizeFor] = useState<string[]>(['readability', 'pace']);
  const [avoid, setAvoid] = useState<string[]>(['generic AI voice', 'cliché']);
  const [sourceTruthMode, setSourceTruthMode] = useState<CreativeTarget['sourceTruthMode']>('keep-close');

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
      const preset = LENGTH_PRESETS.find((p) => p.id === lengthPreset);
      const resolvedWords = customWordCount ? Number(customWordCount) : preset?.words;
      const resolvedChapters = targetChapterCount
        ? Number(targetChapterCount)
        : preset?.chapters;

      const creativeTarget: CreativeTarget = {
        readerEffects,
        audienceAfterthought: audienceAfterthought.trim() || undefined,
        aftertaste: aftertaste || undefined,
        intensity,
        literaryBalance,
        optimizeFor,
        avoid,
        sourceTruthMode,
        lengthPreset,
        targetChapterCount: resolvedChapters,
      };

      await patchProductionBrief(projectId, {
        productType,
        audience: audience.trim() || undefined,
        tone: tone.trim() || undefined,
        targetLength: resolvedWords,
        successCriteria: successCriteria.trim() || undefined,
        sourceAssets: assets.map((a) => a.id),
        exportTargets: ['markdown', 'docx'],
        privacyMode: 'local-first',
        creativeTarget,
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
      toast.success('Creative Target saved — CASPA knows what finished means.');
      setStep(5);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === 1 && !projectId) {
      toast.error('Pick a project from Projects first, or open this wizard from a project.');
      return;
    }
    if (step < 4) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    saveMutation.mutate();
  }

  function toggleChip(list: string[], value: string, setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
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

      <form onSubmit={handleSubmit} className="rounded-[2rem] border border-[#eadfca] bg-[#fffdf8] p-4 shadow-paper sm:p-8">
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
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Step 3 · Creative Target</div>
            <p className="text-sm text-muted">
              What should this work do to the reader? CASPA uses this for expansion, finishing, and quality passes.
            </p>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">What should the reader feel?</legend>
              <div className="flex flex-wrap gap-2">
                {READER_EFFECTS.map((effect) => (
                  <button
                    key={effect}
                    type="button"
                    onClick={() => toggleChip(readerEffects, effect, setReaderEffects)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                      readerEffects.includes(effect)
                        ? 'bg-[#171a22] text-white'
                        : 'border border-[#eadfca] bg-white text-[#5f5648]'
                    }`}
                  >
                    {effect}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm">
              What should they think afterwards?
              <textarea
                value={audienceAfterthought}
                onChange={(e) => setAudienceAfterthought(e.target.value)}
                className="input mt-1 min-h-[72px]"
                placeholder="They cannot stop thinking about… / They feel complicit in…"
              />
            </label>

            <label className="block text-sm">
              Desired aftertaste
              <select value={aftertaste} onChange={(e) => setAftertaste(e.target.value)} className="input mt-1">
                <option value="">Choose…</option>
                {AFTERTASTE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Intensity ({intensity}/7)
              <input
                type="range"
                min={1}
                max={7}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Target length</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {LENGTH_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setLengthPreset(preset.id)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm ${
                      lengthPreset === preset.id
                        ? 'border-[#171a22] bg-[#171a22] text-white'
                        : 'border-[#eadfca] bg-white'
                    }`}
                  >
                    <div className="font-semibold">{preset.label}</div>
                    <div className={`text-xs ${lengthPreset === preset.id ? 'text-white/70' : 'text-muted'}`}>
                      ~{preset.words.toLocaleString()} words
                      {preset.chapters ? ` · ~${preset.chapters} sections` : ''}
                    </div>
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Custom word count
                  <input value={customWordCount} onChange={(e) => setCustomWordCount(e.target.value)} className="input mt-1" type="number" min={0} placeholder="80000" />
                </label>
                <label className="text-sm">
                  Target chapters/scenes
                  <input value={targetChapterCount} onChange={(e) => setTargetChapterCount(e.target.value)} className="input mt-1" type="number" min={0} placeholder="24" />
                </label>
              </div>
            </fieldset>

            <label className="block text-sm">
              Literary / commercial balance
              <select
                value={literaryBalance}
                onChange={(e) => setLiteraryBalance(e.target.value as CreativeTarget['literaryBalance'])}
                className="input mt-1"
              >
                <option value="very-commercial">Very commercial</option>
                <option value="commercial-intelligent">Commercial but intelligent</option>
                <option value="upmarket">Upmarket</option>
                <option value="literary">Literary</option>
                <option value="prize-target">Prize-target</option>
                <option value="experimental">Experimental</option>
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Optimise for</legend>
              <div className="flex flex-wrap gap-2">
                {OPTIMIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleChip(optimizeFor, opt, setOptimizeFor)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                      optimizeFor.includes(opt) ? 'bg-[#98711d] text-white' : 'border border-[#eadfca] bg-white'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Avoid</legend>
              <div className="flex flex-wrap gap-2">
                {AVOID_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleChip(avoid, opt, setAvoid)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      avoid.includes(opt) ? 'bg-red-900 text-white' : 'border border-[#eadfca] bg-white'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm">
              Source truth / fiction handling
              <select
                value={sourceTruthMode}
                onChange={(e) => setSourceTruthMode(e.target.value as CreativeTarget['sourceTruthMode'])}
                className="input mt-1"
              >
                <option value="keep-close">Keep close to source</option>
                <option value="light-fiction">Lightly fictionalise</option>
                <option value="heavy-fiction">Heavily fictionalise</option>
                <option value="anonymise">Anonymise</option>
                <option value="pure-fiction">Transform into pure fiction</option>
                <option value="ask">Ask case by case</option>
              </select>
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Step 4 · Brief &amp; intimacy</div>
            <label className="block text-sm">
              Audience
              <input value={audience} onChange={(e) => setAudience(e.target.value)} className="input mt-1" placeholder="Who is this for?" />
            </label>
            <label className="block text-sm">
              Tone
              <input value={tone} onChange={(e) => setTone(e.target.value)} className="input mt-1" placeholder="Warm, literary, commercial…" />
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

        {step === 5 && (
          <div className="space-y-4 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Creative Target ready</div>
            <p className="font-serif text-2xl text-[#171a22]">CASPA knows what you are making.</p>
            {brief?.successCriteria && (
              <p className="text-sm text-muted">{brief.successCriteria}</p>
            )}
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              {projectId && (
                <>
                  <Link to={`/projects/${projectId}/manuscript`} className="btn-primary">
                    Open current work <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to={`/projects/${projectId}/bible`} className="btn-secondary">
                    Generate Project Bible
                  </Link>
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

        {step < 5 && (
          <div className="sticky bottom-0 mt-8 flex flex-wrap justify-between gap-3 border-t border-[#eadfca] bg-[#fffdf8]/95 pt-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur">
            <button
              type="button"
              className="btn-ghost"
              disabled={step === 1}
              onClick={() => setStep((s) => (s - 1) as Step)}
            >
              Back
            </button>
            <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
              {step === 4 ? (saveMutation.isPending ? 'Saving…' : 'Save creative target') : 'Continue'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

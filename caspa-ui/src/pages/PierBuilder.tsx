import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Anchor,
  ArrowRight,
  ExternalLink,
  Loader2,
  Map,
  Plus,
  Sparkles,
  StretchHorizontal,
} from 'lucide-react';
import { getProject } from '../api/projects';
import {
  PIER_STEP_LABELS,
  pierExtend,
  pierLayBoards,
  pierPlacePole,
  pierStretchDecking,
  pierSurvey,
  type PierNextStep,
} from '../api/pier';
import { useAppStore } from '../store';
import { useToast } from '../components/Toast';
import type { PlotPoint } from '../types';

const plotTypes: PlotPoint['type'][] = [
  'inciting-incident',
  'rising-action',
  'climax',
  'falling-action',
  'resolution',
  'other',
];

const stepAccent: Record<PierNextStep, string> = {
  survey: 'text-[#98711d]',
  'place-pole': 'text-[#98711d]',
  'lay-boards': 'text-[#5f5648]',
  'stretch-decking': 'text-[#5f5648]',
  research: 'text-[#8b6914]',
  'revise-boards': 'text-[#5f5648]',
  ready: 'text-emerald-700',
};

export default function PierBuilder() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);

  const [poleTitle, setPoleTitle] = useState('');
  const [poleDescription, setPoleDescription] = useState('');
  const [poleType, setPoleType] = useState<PlotPoint['type']>('other');
  const [fromPoleId, setFromPoleId] = useState('');
  const [toPoleId, setToPoleId] = useState('');
  const [stretchText, setStretchText] = useState('');
  const [stretchPurpose, setStretchPurpose] = useState('');

  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  });

  const {
    data: survey,
    isLoading: surveyLoading,
    refetch: refetchSurvey,
  } = useQuery({
    queryKey: ['pier-survey', id],
    queryFn: () => pierSurvey(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (survey?.gaps[0]) {
      setFromPoleId((current) => current || survey.gaps[0].fromPoleId);
      setToPoleId((current) => current || survey.gaps[0].toPoleId);
    }
  }, [survey?.gaps]);

  const sortedPoles = useMemo(
    () => [...(survey?.poles ?? [])].sort((a, b) => a.order - b.order),
    [survey?.poles],
  );

  const placePoleMutation = useMutation({
    mutationFn: () =>
      pierPlacePole(id!, {
        title: poleTitle,
        description: poleDescription,
        type: poleType,
      }),
    onSuccess: (result) => {
      toast.success(result.created ? 'Structural pole placed' : 'Pole updated');
      setPoleTitle('');
      setPoleDescription('');
      queryClient.invalidateQueries({ queryKey: ['pier-survey', id] });
      queryClient.invalidateQueries({ queryKey: ['plot', id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const layBoardsMutation = useMutation({
    mutationFn: () => pierLayBoards(id!, { fromPoleId, toPoleId }),
    onSuccess: (result) => {
      if (result.refused) {
        toast.error(result.message);
        return;
      }
      toast.success(`Boards saved to Outputs · ${result.outputId.slice(0, 8)}`);
      refetchSurvey();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stretchMutation = useMutation({
    mutationFn: () =>
      pierStretchDecking(id!, {
        sourceText: stretchText,
        structuralPurpose: stretchPurpose,
      }),
    onSuccess: (result) => {
      if (result.refused) {
        toast.error(result.message);
        return;
      }
      toast.success(`Stretch saved · +${result.addedWords} words · ${result.outputId.slice(0, 8)}`);
      refetchSurvey();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const extendMutation = useMutation({
    mutationFn: () => pierExtend(id!),
    onSuccess: () => {
      refetchSurvey();
      toast.success('Pier extended — recommendation refreshed');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (projectLoading || surveyLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#98711d]" />
      </div>
    );
  }

  if (!project || !survey) {
    return <p className="py-20 text-center text-muted">Project not found</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <section className="overflow-hidden rounded-[2.4rem] border border-[#eadfca] bg-white shadow-room">
        <div className="p-7 md:p-10">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Link to={`/projects/${id}`} className="text-sm text-muted hover:text-[#171a22]">
              ← Back to project
            </Link>
            <span className="badge">Pier Builder</span>
          </div>
          <h1 className="font-serif text-5xl font-semibold leading-none tracking-[-0.045em] text-[#171a22] md:text-6xl">
            Structure before prose
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted">
            Survey the manuscript, place structural poles, lay boards between beats, and stretch only where
            the story creates a need. AI output stays in Outputs until you apply it.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] p-5">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">
                Recommended next step
              </div>
              <div className={`mt-2 font-serif text-3xl font-semibold ${stepAccent[survey.recommendedNextStep]}`}>
                {PIER_STEP_LABELS[survey.recommendedNextStep]}
              </div>
              <p className="mt-3 text-sm leading-7 text-[#5f5648]">{survey.recommendationReason}</p>
              {survey.warnings.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm text-[#8b6914]">
                  {survey.warnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-[1.5rem] border border-[#eadfca] bg-[#f7f1e6] p-5">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Deck status</div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Words</span>
                  <span className="font-semibold text-[#171a22]">
                    {survey.wordCount.toLocaleString()} / {survey.targetWordCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Progress</span>
                  <span className="font-semibold text-[#171a22]">{survey.progressPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Poles</span>
                  <span className="font-semibold text-[#171a22]">{survey.poleCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Structure units</span>
                  <span className="font-semibold text-[#171a22]">{survey.structureUnitCount}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => extendMutation.mutate()}
                disabled={extendMutation.isPending}
                className="btn-secondary mt-5 w-full"
              >
                {extendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Anchor className="h-4 w-4" />
                )}
                Extend pier
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper">
          <div className="mb-4 flex items-center gap-2">
            <Map className="h-5 w-5 text-[#98711d]" />
            <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Place pole</h2>
          </div>
          <p className="mb-5 text-sm leading-7 text-muted">
            A pole is a structural beat — create or repair it before writing the span between poles.
          </p>
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Title</span>
              <input
                value={poleTitle}
                onChange={(event) => setPoleTitle(event.target.value)}
                className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 outline-none focus:border-[#caa044]"
                placeholder="Harbour discovery"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">
                Structural purpose
              </span>
              <textarea
                value={poleDescription}
                onChange={(event) => setPoleDescription(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 outline-none focus:border-[#caa044]"
                placeholder="Protagonist finds evidence the lighthouse is occupied — raises stakes and foreshadows confrontation."
              />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Beat type</span>
              <select
                value={poleType}
                onChange={(event) => setPoleType(event.target.value as PlotPoint['type'])}
                className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 outline-none focus:border-[#caa044]"
              >
                {plotTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/-/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => placePoleMutation.mutate()}
              disabled={placePoleMutation.isPending || !poleTitle.trim() || !poleDescription.trim()}
              className="btn-primary"
            >
              {placePoleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Place pole
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#98711d]" />
            <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Lay boards</h2>
          </div>
          <p className="mb-5 text-sm leading-7 text-muted">
            Write prose between two poles. Saved to Outputs — nothing overwrites your manuscript silently.
          </p>
          {sortedPoles.length < 2 ? (
            <p className="rounded-2xl border border-dashed border-[#eadfca] bg-[#fffdf8] p-4 text-sm text-muted">
              Place at least two poles before laying boards.
            </p>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">From pole</span>
                <select
                  value={fromPoleId}
                  onChange={(event) => setFromPoleId(event.target.value)}
                  className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 outline-none focus:border-[#caa044]"
                >
                  {sortedPoles.map((pole) => (
                    <option key={pole.id} value={pole.id}>
                      {pole.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">To pole</span>
                <select
                  value={toPoleId}
                  onChange={(event) => setToPoleId(event.target.value)}
                  className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 outline-none focus:border-[#caa044]"
                >
                  {sortedPoles.map((pole) => (
                    <option key={pole.id} value={pole.id}>
                      {pole.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => layBoardsMutation.mutate()}
                disabled={layBoardsMutation.isPending || !fromPoleId || !toPoleId}
                className="btn-primary"
              >
                {layBoardsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Lay boards
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper">
        <div className="mb-4 flex items-center gap-2">
          <StretchHorizontal className="h-5 w-5 text-[#98711d]" />
          <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Stretch decking</h2>
        </div>
        <p className="mb-5 max-w-3xl text-sm leading-7 text-muted">
          Expand only where a documented structural purpose requires it. Vague requests are refused as filler.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Source excerpt</span>
            <textarea
              value={stretchText}
              onChange={(event) => setStretchText(event.target.value)}
              rows={6}
              className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 outline-none focus:border-[#caa044]"
              placeholder="Paste the passage to expand…"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">
              Structural purpose
            </span>
            <textarea
              value={stretchPurpose}
              onChange={(event) => setStretchPurpose(event.target.value)}
              rows={6}
              className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 outline-none focus:border-[#caa044]"
              placeholder="Deepen the relationship tension before the reversal — foreshadow the antagonist's choice."
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => stretchMutation.mutate()}
          disabled={stretchMutation.isPending || !stretchText.trim() || !stretchPurpose.trim()}
          className="btn-secondary mt-4"
        >
          {stretchMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <StretchHorizontal className="h-4 w-4" />
          )}
          Stretch decking
        </button>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#98711d]">Structural poles</div>
            <h2 className="mt-1 font-serif text-3xl font-semibold text-[#171a22]">Current pier map</h2>
          </div>
          <Link to={`/projects/${id}/plot`} className="btn-secondary">
            <ExternalLink className="h-4 w-4" /> Open Plot Board
          </Link>
        </div>

        {sortedPoles.length === 0 ? (
          <div className="rounded-[2rem] border border-[#eadfca] bg-white/85 py-14 text-center shadow-paper">
            <Anchor className="mx-auto mb-4 h-12 w-12 text-[#98711d] opacity-60" />
            <p className="text-muted">No poles yet. Place the first structural beat to begin the pier.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedPoles.map((pole, index) => (
              <div
                key={pole.id}
                className="rounded-[1.6rem] border border-[#eadfca] bg-white px-5 py-4 shadow-paper"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-serif text-xl font-semibold text-[#171a22]">
                    {index + 1}. {pole.title}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                      pole.complete
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {pole.complete ? 'Ready' : 'Needs purpose'}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-7 text-[#5f5648]">{pole.description || 'No structural purpose yet.'}</p>
              </div>
            ))}
          </div>
        )}

        {survey.gaps.length > 0 && (
          <div className="rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] p-5">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Span gaps</div>
            <ul className="mt-3 space-y-2 text-sm text-[#5f5648]">
              {survey.gaps.map((gap) => (
                <li key={`${gap.fromPoleId}-${gap.toPoleId}`}>
                  {gap.fromTitle} → {gap.toTitle}
                  {' · '}
                  {gap.hasProseCoverage ? 'prose coverage detected' : 'needs boards'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

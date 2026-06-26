import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Scale, Sparkles, Trophy } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { useAppStore } from '../store';
import { useWorkbenchSourceText } from '../hooks/useWorkbenchSourceText';
import {
  artistStatement,
  awardsReadiness,
  categoryFit,
  createCustomAwardLens,
  festivalPack,
  getProjectAwardsShelf,
  judgesBrief,
  listAwardLenses,
  pullQuotes,
  runAwardAssessment,
  updateProjectAwardsShelf,
  type AwardAssessmentResult,
  type AwardLens,
} from '../api/awards';

const categoryLabels: Record<string, string> = {
  literary: 'Literary',
  genre: 'Genre',
  theatre: 'Theatre',
  screen: 'Screen',
  children: 'Children / YA',
  nonfiction: 'Nonfiction',
  commercial: 'Commercial',
  custom: 'Custom',
};

function AwardsShelfContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const workbenchSource = useAppStore((s) => s.workbenchSource);
  const { text: workbenchText } = useWorkbenchSourceText(projectId, workbenchSource);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assessmentStage, setAssessmentStage] = useState<'draft' | 'revision' | 'submission'>('draft');
  const [sourceText, setSourceText] = useState('');
  const [assessment, setAssessment] = useState<AwardAssessmentResult | null>(null);
  const [legacyResult, setLegacyResult] = useState<unknown>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customForm, setCustomForm] = useState({
    name: '',
    description: '',
    rubricFocus: '',
    inspiredBy: '',
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ['awards-catalog'],
    queryFn: listAwardLenses,
  });

  const { data: shelf, isLoading: shelfLoading } = useQuery({
    queryKey: ['project-awards', projectId],
    queryFn: () => getProjectAwardsShelf(projectId),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (shelf?.selectedAwardIds) {
      setSelectedIds(shelf.selectedAwardIds);
    }
  }, [shelf?.selectedAwardIds]);

  const grouped = useMemo(() => {
    const map = new Map<string, AwardLens[]>();
    for (const lens of catalog) {
      const key = lens.category || 'custom';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lens);
    }
    return map;
  }, [catalog]);

  const saveShelfMutation = useMutation({
    mutationFn: () => updateProjectAwardsShelf(projectId, selectedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-awards', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Awards shelf updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assessMutation = useMutation({
    mutationFn: () =>
      runAwardAssessment({
        projectId,
        awardIds: selectedIds,
        sourceText: sourceText.trim() || workbenchText || undefined,
        stage: assessmentStage,
      }),
    onSuccess: (result) => {
      setAssessment(result);
      toast.success(`Assessment saved · ${result.outputId.slice(0, 8)}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const customMutation = useMutation({
    mutationFn: () =>
      createCustomAwardLens({
        name: customForm.name,
        description: customForm.description,
        rubricFocus: customForm.rubricFocus.split(',').map((item) => item.trim()).filter(Boolean),
        inspiredBy: customForm.inspiredBy || undefined,
        category: 'custom',
      }),
    onSuccess: (lens) => {
      queryClient.invalidateQueries({ queryKey: ['awards-catalog'] });
      setSelectedIds((current) => [...current, lens.id]);
      setCustomOpen(false);
      setCustomForm({ name: '', description: '', rubricFocus: '', inspiredBy: '' });
      toast.success('Custom lens added to catalog');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const legacyMutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'readiness') return awardsReadiness(projectId);
      if (action === 'festival') return festivalPack(projectId);
      if (action === 'artist') return artistStatement(projectId);
      if (action === 'judges') return judgesBrief(projectId);
      if (action === 'quotes') return pullQuotes(projectId);
      return categoryFit(projectId);
    },
    onSuccess: (data) => {
      setLegacyResult(data);
      toast.success('Submission material generated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleLens = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  if (shelfLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#98711d]" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Target lenses</div>
            <h2 className="mt-1 font-serif text-3xl font-semibold text-[#171a22]">Choose your shelf</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
              Select inspired-by prize and market standards. Assessments are rubric lenses — not official judging criteria.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCustomOpen(true)} className="btn-secondary">
              <Plus className="h-4 w-4" /> Custom rubric
            </button>
            <button
              type="button"
              onClick={() => saveShelfMutation.mutate()}
              disabled={saveShelfMutation.isPending}
              className="btn-primary"
            >
              Save shelf
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {[...grouped.entries()].map(([category, lenses]) => (
            <div key={category}>
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">
                {categoryLabels[category] ?? category}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {lenses.map((lens) => {
                  const selected = selectedIds.includes(lens.id);
                  return (
                    <button
                      key={lens.id}
                      type="button"
                      onClick={() => toggleLens(lens.id)}
                      className={`rounded-[1.5rem] border p-4 text-left transition-all ${
                        selected
                          ? 'border-[#98711d] bg-[#fffaf0] shadow-paper'
                          : 'border-[#eadfca] bg-[#fffdf8] hover:border-[#caa044]'
                      }`}
                    >
                      <div className="font-serif text-lg font-semibold text-[#171a22]">{lens.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.14em] text-[#98711d]">{lens.inspiredBy}</div>
                      <p className="mt-2 text-sm leading-6 text-[#5f5648]">{lens.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper">
        <div className="mb-4 flex items-center gap-2">
          <Scale className="h-5 w-5 text-[#98711d]" />
          <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Judges&apos; assessment</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
          <label className="block text-sm">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Stage</span>
            <select
              value={assessmentStage}
              onChange={(event) => setAssessmentStage(event.target.value as typeof assessmentStage)}
              className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#caa044]"
            >
              <option value="draft">Draft</option>
              <option value="revision">Revision</option>
              <option value="submission">Submission</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">
              Optional excerpt (defaults to project manuscript)
            </span>
            <textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#caa044]"
              placeholder="Paste a passage to assess…"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => assessMutation.mutate()}
          disabled={assessMutation.isPending || selectedIds.length === 0}
          className="btn-primary mt-4"
        >
          {assessMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Run assessment ({selectedIds.length} lens{selectedIds.length === 1 ? '' : 'es'})
        </button>

        {assessment && (
          <div className="mt-6 space-y-5">
            <div className="rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] p-5">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#98711d]">Overall readiness</div>
              <div className="mt-2 font-serif text-4xl font-semibold text-[#171a22]">{assessment.overallReadiness}%</div>
              <p className="mt-2 text-xs text-muted">{assessment.disclaimer}</p>
              <Link to={`/outputs/${assessment.outputId}`} className="btn-secondary mt-4 inline-flex text-xs">
                Open saved output
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(assessment.proseAssessment).map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-[#eadfca] bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#98711d]">{key}</div>
                  <div className="mt-1 text-xl font-semibold text-[#171a22]">{value}</div>
                </div>
              ))}
            </div>

            {assessment.awardFit.map((fit) => (
              <div key={fit.awardId} className="rounded-[1.5rem] border border-[#eadfca] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-serif text-xl font-semibold text-[#171a22]">{fit.awardName}</div>
                  <div className="text-2xl font-semibold text-[#98711d]">{fit.score}%</div>
                </div>
                <p className="mt-3 text-sm leading-7 text-[#5f5648]">{fit.judgeComments}</p>
                {fit.recommendedRevisions.length > 0 && (
                  <ul className="mt-3 list-disc pl-5 text-sm text-[#5f5648]">
                    {fit.recommendedRevisions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-[#eadfca] bg-[#fffdf8] p-6">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Submission materials</div>
        <p className="mt-2 mb-4 text-sm text-muted">Legacy elevation pack generators — festival packs, statements, and quotes.</p>
        <div className="flex flex-wrap gap-2">
          {[
            ['readiness', 'Readiness Pack'],
            ['festival', 'Festival Fit'],
            ['artist', 'Artist Statement'],
            ['judges', 'Judges Brief'],
            ['quotes', 'Pull Quotes'],
            ['category', 'Category Fit'],
          ].map(([action, label]) => (
            <button
              key={action}
              type="button"
              disabled={legacyMutation.isPending}
              onClick={() => legacyMutation.mutate(action)}
              className="btn-secondary text-xs"
            >
              {label}
            </button>
          ))}
        </div>
        {legacyResult !== null && (
          <div className="mt-4">
            <ResultCard title="Legacy results">
              <JsonPreview data={legacyResult} />
            </ResultCard>
          </div>
        )}
      </section>

      {customOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/60 p-4 backdrop-blur-md">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-room">
            <h3 className="font-serif text-2xl font-semibold text-[#171a22]">Custom rubric lens</h3>
            <div className="mt-5 space-y-4">
              <input
                value={customForm.name}
                onChange={(event) => setCustomForm({ ...customForm, name: event.target.value })}
                placeholder="Matthew standard"
                className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-sm"
              />
              <textarea
                value={customForm.description}
                onChange={(event) => setCustomForm({ ...customForm, description: event.target.value })}
                placeholder="What this lens rewards…"
                rows={3}
                className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-sm"
              />
              <input
                value={customForm.rubricFocus}
                onChange={(event) => setCustomForm({ ...customForm, rubricFocus: event.target.value })}
                placeholder="Rubric focus (comma-separated)"
                className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-sm"
              />
              <input
                value={customForm.inspiredBy}
                onChange={(event) => setCustomForm({ ...customForm, inspiredBy: event.target.value })}
                placeholder="Inspired-by label (optional)"
                className="w-full rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-sm"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setCustomOpen(false)} className="btn-secondary">Cancel</button>
              <button
                type="button"
                disabled={!customForm.name.trim() || !customForm.description.trim() || customMutation.isPending}
                onClick={() => customMutation.mutate()}
                className="btn-primary"
              >
                Create lens
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { AwardsShelfContent };

export default function Awards() {
  return (
    <ElevationWorkbench
      title="Awards Shelf"
      subtitle="Choose target prize and market lenses, run judges' assessments, and save readiness reports to Outputs."
      icon={<Trophy className="h-4 w-4 text-[#98711d]" />}
    >
      {({ projectId }) => <AwardsShelfContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}

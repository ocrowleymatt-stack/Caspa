import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Loader2,
  BookMarked,
  BookOpen,
  PenLine,
  Plus,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { getProject, getProjectStats } from '../api/projects';
import { getProjectBible } from '../api/bible';
import {
  createChapter,
  getChapter,
  listChapters,
} from '../api/chapters';
import { listOutputs } from '../api/outputs';
import { finishBook, getBookMap } from '../api/book';
import { useAppStore } from '../store';
import {
  casperImproveUrl,
  isSourceChapter,
  pickContinueChapter,
  pickImprovementSourceChapter,
} from '../lib/manuscriptWorkflow';
import { structureLabel, workTypeLabel } from '../lib/workModel';
import { ImproveManuscriptPanel } from '../components/ImproveManuscriptPanel';
import { useToast } from '../components/Toast';

export default function ProjectOverview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);

  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  });

  const { data: stats } = useQuery({
    queryKey: ['project-stats', id],
    queryFn: () => getProjectStats(id!),
    enabled: !!id,
  });

  const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ['chapters', id],
    queryFn: () => listChapters(id!),
    enabled: !!id,
  });

  const { data: bible } = useQuery({
    queryKey: ['bible', id],
    queryFn: () => getProjectBible(id!),
    enabled: !!id,
  });

  const { data: outputs = [] } = useQuery({
    queryKey: ['outputs', id],
    queryFn: () => listOutputs(id!),
    enabled: !!id,
  });

  const { data: bookMap } = useQuery({
    queryKey: ['book-map', id],
    queryFn: () => getBookMap(id!),
    enabled: !!id,
  });

  const finishBookMutation = useMutation({
    mutationFn: () => finishBook({ projectId: id!, mode: 'plan' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['outputs', id] });
      toast.success(`Finish plan saved · ${String(result.outputId ?? '').slice(0, 8)}`);
      if (result.outputId) navigate(`/outputs/${result.outputId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createChapter(id!, {
        title: `Chapter ${chapters.length + 1}`,
        order: chapters.length,
      }),
    onSuccess: (chapter) => {
      queryClient.invalidateQueries({ queryKey: ['chapters', id] });
      toast.success('Chapter created');
      navigate(`/projects/${id}/chapters/${chapter.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const continueChapter = useMemo(() => pickContinueChapter(chapters), [chapters]);
  const defaultImproveChapter = useMemo(() => pickImprovementSourceChapter(chapters), [chapters]);
  const [improveChapterId, setImproveChapterId] = useState<string | null>(null);

  useEffect(() => {
    if (defaultImproveChapter) {
      setImproveChapterId((current) => current ?? defaultImproveChapter.id);
    }
  }, [defaultImproveChapter?.id]);

  const { data: improveChapterDetail } = useQuery({
    queryKey: ['chapter', improveChapterId],
    queryFn: () => getChapter(improveChapterId!),
    enabled: !!improveChapterId,
  });

  const sourceChapter = useMemo(
    () => chapters.find((chapter) => isSourceChapter(chapter)),
    [chapters],
  );

  const latestOutput = outputs[0] ?? null;
  const hasBible = Boolean(bible?.premise?.trim() || bible?.structure?.trim());
  const hasResearch = (stats?.noteCount ?? 0) > 0;

  const projectMode = useMemo(() => {
    if (!project) return 'blank' as const;
    if (outputs.length > 0 && chapters.length === 0) return 'output-led';
    if (hasResearch && chapters.length === 0) return 'research-led';
    if (hasBible && chapters.length === 0 && outputs.length === 0) return 'bible-led';
    if (project.genre === 'Manuscript Polish' || sourceChapter) return 'manuscript';
    if (chapters.length === 0) return 'blank';
    if (outputs.length > 0) return 'output-led';
    if (hasResearch) return 'research-led';
    if (hasBible) return 'bible-led';
    return 'writing';
  }, [chapters.length, hasBible, hasResearch, outputs.length, project, sourceChapter]);

  if (projectLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#98711d]" />
      </div>
    );
  }

  if (!project) {
    return <p className="py-20 text-center text-muted">Project not found</p>;
  }

  const progress = Math.min(
    100,
    Math.round((project.currentWordCount / (project.targetWordCount || 1)) * 100),
  );

  const modeCopy = {
    blank: 'Blank room — no manuscript yet. Auto-write, upload a file, or generate a Project Bible.',
    manuscript: 'Manuscript project — your original upload is preserved. Revisions save as outputs until you apply them.',
    writing: 'Writing room — continue the latest draft or run Novel Write Pro for a new pass.',
    'output-led': 'Output-led — saved AI drafts live in Outputs. Continue from the latest or run Gold before applying.',
    'bible-led': 'Bible-led — premise and plan are ready. Write from the bible or generate structure next.',
    'research-led': 'Research-led — confirmed notes are in the library. Use them in the next writing or accuracy pass.',
  } as const;

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <section className="overflow-hidden rounded-[2.4rem] border border-[#eadfca] bg-white shadow-room">
        <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
          <div className="p-7 md:p-10">
            <span className="badge mb-4">{workTypeLabel(project.workType) || project.genre}</span>
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted">
              {project.fictionality && (
                <span className="rounded-full border border-[#eadfca] bg-[#fffdf8] px-3 py-1 capitalize">
                  {project.fictionality}
                </span>
              )}
              {project.structureType && (
                <span className="rounded-full border border-[#eadfca] bg-[#fffdf8] px-3 py-1">
                  {structureLabel(project.structureType)}
                </span>
              )}
              {project.workflowStage && (
                <span className="rounded-full border border-[#eadfca] bg-[#fffdf8] px-3 py-1 capitalize">
                  {project.workflowStage.replace(/-/g, ' ')}
                </span>
              )}
            </div>
            <h1 className="font-serif text-4xl font-semibold leading-none tracking-[-0.045em] text-[#171a22] md:text-5xl">
              {project.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              {project.description || 'No description yet. This room is waiting for its first proper sentence.'}
            </p>
            <nav
              aria-label="Project workflow"
              className="mt-5 flex flex-wrap items-center gap-2 rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] px-4 py-3"
            >
              {[
                { to: `/projects/${id}/sources`, label: 'Sources' },
                { to: `/projects/${id}/bible`, label: 'Plan' },
                { to: `/projects/${id}/manuscript`, label: 'Write' },
                { to: `/projects/${id}/gold`, label: 'Improve' },
                { to: `/projects/${id}/export`, label: 'Export' },
              ].map((step, index, steps) => (
                <span key={step.to} className="flex items-center gap-2">
                  <Link
                    to={step.to}
                    className="rounded-full border border-[#eadfca] bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#5f5648] transition hover:border-[#caa044] hover:text-[#171a22]"
                  >
                    {step.label}
                  </Link>
                  {index < steps.length - 1 && (
                    <span className="text-[#caa044]" aria-hidden>
                      →
                    </span>
                  )}
                </span>
              ))}
            </nav>
            <div className="mt-5 rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] p-4 text-sm leading-7 text-[#5f5648]">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">
                Room mode · {projectMode.replace('-', ' ')}
              </div>
              <p className="mt-2">{modeCopy[projectMode]}</p>
              {bookMap && bookMap.missingSections.length > 0 && (
                <p className="mt-2 text-xs text-muted">
                  Missing: {bookMap.missingSections.slice(0, 3).join(' · ')}
                  {bookMap.missingSections.length > 3 ? '…' : ''}
                </p>
              )}
            </div>
            <div className="mt-7 space-y-4">
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#98711d]">Start here</div>
                <div className="flex flex-wrap gap-3">
                  {projectMode === 'blank' && (
                    <>
                      <Link to={`/casper?projectId=${id}`} className="btn-primary">
                        <Sparkles className="h-4 w-4" /> Auto-write
                      </Link>
                      <Link to={`/projects/${id}/bible`} className="btn-secondary">
                        <BookOpen className="h-4 w-4" /> Generate Bible
                      </Link>
                    </>
                  )}
                  {projectMode === 'manuscript' && improveChapterId && (
                    <Link to={casperImproveUrl(id!, improveChapterId)} className="btn-primary">
                      <Sparkles className="h-4 w-4" /> Improve manuscript
                    </Link>
                  )}
                  {projectMode === 'manuscript' && sourceChapter && (
                    <Link to={`/projects/${id}/chapters/${sourceChapter.id}`} className="btn-secondary">
                      <FileText className="h-4 w-4" /> Open original
                    </Link>
                  )}
                  {projectMode === 'bible-led' && (
                    <>
                      <Link to={`/projects/${id}/bible`} className="btn-primary">
                        <BookOpen className="h-4 w-4" /> Write from bible
                      </Link>
                      <Link to={`/casper?projectId=${id}`} className="btn-secondary">
                        <Sparkles className="h-4 w-4" /> Auto-write scene
                      </Link>
                    </>
                  )}
                  {projectMode === 'research-led' && (
                    <Link to={`/projects/${id}/research`} className="btn-primary">
                      <BookMarked className="h-4 w-4" /> Open Research Desk
                    </Link>
                  )}
                  {projectMode === 'output-led' && latestOutput && (
                    <Link to={`/outputs/${latestOutput.id}`} className="btn-primary">
                      <PenLine className="h-4 w-4" /> Continue from latest output
                    </Link>
                  )}
                  {continueChapter && projectMode !== 'blank' && (
                    <Link to={`/projects/${id}/chapters/${continueChapter.id}`} className="btn-secondary">
                      <PenLine className="h-4 w-4" /> Continue writing
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => finishBookMutation.mutate()}
                    disabled={finishBookMutation.isPending}
                    className="btn-secondary"
                  >
                    {finishBookMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    Finish This Book
                  </button>
                  <Link to={`/projects/${id}/book-map`} className="btn-secondary">
                    <BookOpen className="h-4 w-4" /> Book Map
                  </Link>
                </div>
              </div>
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#98711d]">Polish & archive</div>
                <div className="flex flex-wrap gap-3">
                  <Link to={`/projects/${id}/gold`} className="btn-secondary">
                    <Wand2 className="h-4 w-4" /> Run Gold Pass
                  </Link>
                  <Link to={`/projects/${id}/outputs`} className="btn-secondary">
                    Open Saved Writing
                  </Link>
                  <Link to={`/projects/${id}/export`} className="btn-secondary">
                    <Upload className="h-4 w-4" /> Export
                  </Link>
                </div>
              </div>
              <details className="rounded-[1.4rem] border border-[#eadfca] bg-[#fffdf8] p-4">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">
                  Advanced tools
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/projects/${id}/manuscript`} className="btn-secondary text-xs">
                    Manuscript units
                  </Link>
                  <Link to={`/projects/${id}/pier`} className="btn-secondary text-xs">
                    Pier Builder
                  </Link>
                  <Link to={`/projects/${id}/research`} className="btn-secondary text-xs">
                    Research Desk
                  </Link>
                  <Link to={`/projects/${id}/awards`} className="btn-secondary text-xs">
                    Awards Shelf
                  </Link>
                  <Link to={`/projects/${id}/swarm`} className="btn-secondary text-xs">
                    Agent Swarm
                  </Link>
                  <Link to={`/projects/${id}/bible`} className="btn-secondary text-xs">
                    Project Bible
                  </Link>
                </div>
              </details>
            </div>
          </div>

          <div className="border-t border-[#eadfca] bg-[#f7f1e6] p-7 lg:border-l lg:border-t-0">
            <div className="rounded-[1.8rem] border border-[#eadfca] bg-[#fffdf8] p-5 shadow-paper">
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">Progress</div>
              <div className="text-5xl font-semibold text-[#171a22]">{progress}%</div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#f1e6d2]">
                <div className="h-full rounded-full bg-[#171a22]" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { label: 'Words', value: stats?.wordCount ?? project.currentWordCount },
                  { label: 'Chapters', value: stats?.chapterCount ?? chapters.length },
                  { label: 'Characters', value: stats?.characterCount ?? 0 },
                  { label: 'Notes', value: stats?.noteCount ?? 0 },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#98711d]">{stat.label}</p>
                    <p className="mt-1 text-xl font-semibold text-[#171a22]">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {(projectMode === 'manuscript' || (chapters.length > 0 && defaultImproveChapter)) && (
        <section className="space-y-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#98711d]">Manuscript improvement</div>
            <h2 className="mt-1 font-serif text-3xl font-semibold text-[#171a22]">Improve this manuscript</h2>
          </div>
          {chapters.length > 1 && (
            <label className="block max-w-md text-sm text-[#5f5648]">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Source chapter</span>
              <select
                value={improveChapterId ?? ''}
                onChange={(event) => setImproveChapterId(event.target.value)}
                className="w-full rounded-2xl border border-[#eadfca] bg-white px-4 py-3 text-sm text-[#171a22] outline-none focus:border-[#caa044]"
              >
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.title} ({chapter.wordCount.toLocaleString()} words)
                  </option>
                ))}
              </select>
            </label>
          )}
          {improveChapterDetail && project && (
            <ImproveManuscriptPanel
              projectId={id!}
              projectTitle={project.title}
              sourceChapterId={improveChapterDetail.id}
              sourceChapterTitle={improveChapterDetail.title}
              sourceText={improveChapterDetail.content}
            />
          )}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#98711d]">Manuscript</div>
            <h2 className="mt-1 font-serif text-3xl font-semibold text-[#171a22]">
              {chapters.length} structure unit{chapters.length === 1 ? '' : 's'}
            </h2>
          </div>
          <Link to={`/projects/${id}/manuscript`} className="btn-primary">
            Open manuscript tab
          </Link>
        </div>

        {chaptersLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#98711d]" />
          </div>
        ) : chapters.length === 0 ? (
          <div className="rounded-[2rem] border border-[#eadfca] bg-white/85 py-14 text-center shadow-paper">
            <FileText className="mx-auto mb-4 h-12 w-12 text-[#98711d] opacity-60" />
            <p className="mb-5 text-muted">No units yet. Start with the first page.</p>
            <button type="button" onClick={() => createMutation.mutate()} className="btn-primary">
              <Plus className="h-4 w-4" /> Create First Chapter
            </button>
          </div>
        ) : (
          <div className="rounded-[2rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper">
            <p className="text-sm text-muted">
              Reorder and edit units in the Manuscript tab. Latest:{' '}
              <Link to={`/projects/${id}/chapters/${chapters[chapters.length - 1]?.id}`} className="font-semibold text-[#98711d]">
                {chapters[chapters.length - 1]?.title}
              </Link>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

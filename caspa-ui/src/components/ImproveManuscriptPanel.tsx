import { useMutation } from '@tanstack/react-query';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createChapter, listChapters } from '../api/chapters';
import { runNovelWritePro } from '../api/casper';
import { countWords } from '../lib/utils';
import { useToast } from './Toast';

interface ImproveManuscriptPanelProps {
  projectId: string;
  projectTitle: string;
  sourceChapterId: string;
  sourceChapterTitle: string;
  sourceText: string;
  tone?: string;
  createRevisionChapter?: boolean;
  compact?: boolean;
}

export function ImproveManuscriptPanel({
  projectId,
  projectTitle,
  sourceChapterId,
  sourceChapterTitle,
  sourceText,
  tone = 'Clear, vivid, witty, production-minded.',
  createRevisionChapter = true,
  compact = false,
}: ImproveManuscriptPanelProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const wordCount = countWords(sourceText);
  const pendingLabel = 'Novel Write Pro is drafting... (plan → draft → critic → rewrite — ~4–5 min on Ollama)';

  const improveMutation = useMutation({
    mutationFn: async () => {
      if (!sourceText.trim()) {
        throw new Error('No manuscript text found. Upload or paste manuscript text first.');
      }

      const draft = await runNovelWritePro({
        projectId,
        chapterId: sourceChapterId,
        sourceChapterTitle,
        improveExisting: true,
        mode: 'polish',
        modeTitle: 'Polish',
        genre: 'Manuscript Polish',
        spark: `Improve existing manuscript in "${projectTitle}"`,
        source: sourceText,
        tone,
        output: 'Award Pass Rewrite',
      });

      let revisionChapterId: string | undefined;
      if (createRevisionChapter) {
        const chapters = await listChapters(projectId);
        const revision = await createChapter(projectId, {
          title: `Manuscript improvement — ${sourceChapterTitle}`,
          order: chapters.length,
          content: draft.text,
          status: 'draft',
        });
        revisionChapterId = revision.id;
      }

      return { draft, revisionChapterId };
    },
    onSuccess: ({ draft, revisionChapterId }) => {
      toast.success(
        `Manuscript improved · output ${draft.outputId.slice(0, 8)} · original preserved`,
      );
      if (revisionChapterId) {
        navigate(`/projects/${projectId}/chapters/${revisionChapterId}`);
        return;
      }
      navigate(`/outputs/${draft.outputId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!sourceText.trim()) {
    return (
      <div className={`rounded-[1.5rem] border border-[#eadfca] bg-[#fff8e8] p-4 text-sm text-[#5f5648] ${compact ? '' : 'shadow-paper'}`}>
        No manuscript text found. Upload or paste manuscript text first.
      </div>
    );
  }

  return (
    <div className={`rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] p-4 ${compact ? '' : 'shadow-paper'}`}>
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Source for improvement</div>
      <ul className="mt-3 space-y-1 text-sm leading-7 text-[#3d352b]">
        <li><strong>Project:</strong> {projectTitle}</li>
        <li><strong>Source chapter:</strong> {sourceChapterTitle}</li>
        <li><strong>Approx words:</strong> {wordCount.toLocaleString()}</li>
        <li><strong>Mode:</strong> Manuscript polish / award pass</li>
      </ul>
      <p className="mt-3 text-sm leading-6 text-[#5f5648]">
        Original manuscript will be preserved. CASPA will save the revision as a new output
        {createRevisionChapter ? ' and a labelled revision chapter' : ''}.
      </p>
      <button
        type="button"
        onClick={() => improveMutation.mutate()}
        disabled={improveMutation.isPending}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-[1.35rem] bg-[#f5d37a] px-5 py-3 text-sm font-bold text-[#171a22] shadow-lg transition hover:bg-[#ffe39a] disabled:opacity-60 ${compact ? '' : 'md:w-auto md:px-8'}`}
      >
        {improveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {improveMutation.isPending ? pendingLabel : 'Improve this manuscript'}
      </button>
    </div>
  );
}

export function ImproveManuscriptLinkButton({
  projectId,
  chapterId,
  label = 'Improve this manuscript',
  className = 'btn-primary',
}: {
  projectId: string;
  chapterId?: string;
  label?: string;
  className?: string;
}) {
  const href = `/casper?projectId=${encodeURIComponent(projectId)}&improve=1${chapterId ? `&chapterId=${encodeURIComponent(chapterId)}` : ''}`;
  return (
    <Link to={href} className={`inline-flex items-center gap-2 ${className}`}>
      <Sparkles className="h-4 w-4" /> {label}
    </Link>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import GoldPipelinePanel from '../../components/gold/GoldPipeline';
import { CutTightenPanel } from '../../components/CutTightenPanel';
import { ImproveManuscriptPanel } from '../../components/ImproveManuscriptPanel';
import { listChapters } from '../../api/chapters';
import { getProject } from '../../api/projects';
import { countWords } from '../../lib/utils';

export default function ProjectGoldPass() {
  const { id: projectId } = useParams<{ id: string }>();
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });
  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => listChapters(projectId!),
    enabled: !!projectId,
  });

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters],
  );
  const [chapterId, setChapterId] = useState<string>('');

  useEffect(() => {
    if (sortedChapters.length > 0 && !chapterId) {
      setChapterId(sortedChapters[0].id);
    }
  }, [sortedChapters, chapterId]);

  const selectedChapter = sortedChapters.find((chapter) => chapter.id === chapterId);

  if (!projectId || isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedChapters.length > 0 && project && selectedChapter ? (
        <div className="space-y-4">
          <label className="block text-sm text-[#3d352b]">
            <span className="label">Improvement source chapter</span>
            <select
              value={chapterId}
              onChange={(event) => setChapterId(event.target.value)}
              className="input mt-1"
            >
              {sortedChapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  Chapter {chapter.order}: {chapter.title}
                </option>
              ))}
            </select>
          </label>
          <ImproveManuscriptPanel
            projectId={projectId}
            projectTitle={project.title}
            sourceChapterId={selectedChapter.id}
            sourceChapterTitle={selectedChapter.title}
            sourceText={selectedChapter.content ?? ''}
            compact
          />
          <CutTightenPanel
            projectId={projectId}
            unitId={selectedChapter.id}
            unitTitle={selectedChapter.title}
            currentWordCount={countWords(selectedChapter.content ?? '')}
            compact
          />
        </div>
      ) : (
        <CutTightenPanel projectId={projectId} compact />
      )}

      <div className="-mx-2 rounded-[2rem] border border-[#eadfca] bg-[#0B0F19] p-2 md:-mx-4">
        <GoldPipelinePanel embedded />
      </div>
    </div>
  );
}

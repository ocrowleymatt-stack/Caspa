import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Hammer, Loader2 } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { analyseIntake, listIntakeSources } from '../api/intake';
import { recommendProducts } from '../api/productForge';

function ForgeContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [content, setContent] = useState('');
  const [result, setResult] = useState<unknown>(null);

  const { data: sources = [], refetch } = useQuery({
    queryKey: ['intake-sources', projectId],
    queryFn: () => listIntakeSources(projectId || undefined),
  });

  const analyseMutation = useMutation({
    mutationFn: () => analyseIntake({ content, projectId: projectId || undefined }),
    onSuccess: (data) => {
      setResult(data);
      refetch();
      toast.success('Source analysed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recommendMutation = useMutation({
    mutationFn: () => recommendProducts(projectId),
    onSuccess: (data) => {
      setResult(data);
      toast.success('Product recommendations ready');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-[1.6rem] border border-[#eadfca] bg-[#fff8e8] p-5 text-sm leading-7 text-[#5f5648]">
        <p>
          <strong className="text-[#171a22]">Forge is now part of the main workflow.</strong>{' '}
          Messy notes and raw material belong in New Project import, Research Desk, and Project Bible — not a separate intake room.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/projects" className="btn-primary text-xs">New Project / Import</Link>
          {projectId ? (
            <>
              <Link to={`/projects/${projectId}/research`} className="btn-secondary text-xs">Research Desk</Link>
              <Link to={`/projects/${projectId}/bible`} className="btn-secondary text-xs">Project Bible</Link>
            </>
          ) : (
            <Link to="/command" className="btn-secondary text-xs">Studio Command</Link>
          )}
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="input min-h-[120px]"
        placeholder="Paste notes, transcripts, or raw material to classify..."
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!content.trim() || analyseMutation.isPending}
          onClick={() => analyseMutation.mutate()}
          className="btn-primary"
        >
          {analyseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Analyse Source'}
        </button>
        {projectId && (
          <button type="button" disabled={recommendMutation.isPending} onClick={() => recommendMutation.mutate()} className="btn-secondary">
            Recommend Products
          </button>
        )}
        <Link to="/sources" className="btn-secondary">View Sources</Link>
        <Link to="/product-plan" className="btn-secondary">Product Plans</Link>
      </div>
      {sources.length > 0 && (
        <p className="text-sm text-muted">{sources.length} source(s) on ledger</p>
      )}
      {result !== null && (
        <ResultCard title="Forge Result">
          <JsonPreview data={result} />
        </ResultCard>
      )}
    </div>
  );
}

export default function ForgeIntake() {
  return (
    <ElevationWorkbench
      title="Forge (legacy intake)"
      subtitle="Raw material now flows through Import, Research Desk and Project Bible"
      icon={<Hammer className="h-7 w-7 text-accent" />}
      requireProject={false}
    >
      {({ projectId }) => <ForgeContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}

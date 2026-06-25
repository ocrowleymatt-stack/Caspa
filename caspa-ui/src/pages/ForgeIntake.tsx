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
      <textarea value={content} onChange={(e) => setContent(e.target.value)} className="input min-h-[120px]" />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={analyseMutation.isPending} onClick={() => analyseMutation.mutate()} className="btn-primary">
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
      title="Forge & Intake"
      subtitle="Classify sources, assess potential, and recommend product formats"
      icon={<Hammer className="h-7 w-7 text-accent" />}
      requireProject={false}
    >
      {({ projectId }) => <ForgeContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}

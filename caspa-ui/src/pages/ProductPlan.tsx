import { useMutation, useQuery } from '@tanstack/react-query';
import { Layers, Loader2 } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { listProductPlans, recommendProducts } from '../api/productForge';
import { useState } from 'react';

function ProductPlanContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [result, setResult] = useState<unknown>(null);

  const { data: plans = [], refetch } = useQuery({
    queryKey: ['product-plans', projectId],
    queryFn: () => listProductPlans(projectId),
    enabled: Boolean(projectId),
  });

  const mutation = useMutation({
    mutationFn: () => recommendProducts(projectId),
    onSuccess: (data) => {
      setResult(data);
      refetch();
      toast.success('Plan generated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()} className="btn-primary">
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Product Plan'}
      </button>
      {plans.length > 0 && (
        <ResultCard title={`Saved Plans (${plans.length})`}>
          <JsonPreview data={plans} />
        </ResultCard>
      )}
      {result !== null && (
        <ResultCard title="Latest Recommendation">
          <JsonPreview data={result} />
        </ResultCard>
      )}
    </div>
  );
}

export default function ProductPlan() {
  return (
    <ElevationWorkbench
      title="Product Plan"
      subtitle="Novel, audiobook, stage, and musical format recommendations"
      icon={<Layers className="h-7 w-7 text-accent" />}
    >
      {({ projectId }) => <ProductPlanContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Palette } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { applyProfile, extractStyle, listTasteProfiles } from '../api/taste';

function TasteContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [text, setText] = useState('Paste sample text to extract style or apply a taste profile.');
  const [profileId, setProfileId] = useState('');
  const [result, setResult] = useState<unknown>(null);

  const { data: profiles = [] } = useQuery({ queryKey: ['taste-profiles'], queryFn: listTasteProfiles });

  const mutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'extract') return extractStyle(text, projectId || undefined);
      if (!profileId) throw new Error('Select a taste profile');
      return applyProfile(profileId, text);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Taste analysis complete');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className="input max-w-md">
        <option value="">Select taste profile...</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <textarea value={text} onChange={(e) => setText(e.target.value)} className="input min-h-[100px]" />
      <div className="flex gap-2">
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('extract')} className="btn-primary">
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Extract Style'}
        </button>
        <button type="button" disabled={mutation.isPending || !profileId} onClick={() => mutation.mutate('apply')} className="btn-secondary">Apply Profile</button>
      </div>
      {result !== null && <ResultCard title="Results"><JsonPreview data={result} /></ResultCard>}
    </div>
  );
}

export default function Taste() {
  return (
    <ElevationWorkbench title="Taste Profiles" subtitle="Style DNA, profiles, and preference memory" icon={<Palette className="h-7 w-7 text-accent" />} requireProject={false}>
      {({ projectId }) => <TasteContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}

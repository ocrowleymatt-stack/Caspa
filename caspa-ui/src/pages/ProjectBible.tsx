import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { generateProjectBible, getProjectBible, patchProjectBible, type ProjectBible } from '../api/bible';
import { getProject } from '../api/projects';
import { listOutputs } from '../api/outputs';
import { useToast } from '../components/Toast';

export default function ProjectBiblePage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  });

  const { data: bible, isLoading } = useQuery({
    queryKey: ['project-bible', id],
    queryFn: () => getProjectBible(id!),
    enabled: !!id,
  });

  const { data: outputs = [] } = useQuery({
    queryKey: ['outputs', id],
    queryFn: () => listOutputs(id),
    enabled: !!id,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateProjectBible(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-bible', id] });
      queryClient.invalidateQueries({ queryKey: ['outputs', id] });
      toast.success('Project Bible generated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: (patch: Parameters<typeof patchProjectBible>[1]) => patchProjectBible(id!, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-bible', id] });
      toast.success('Project Bible saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !bible) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#98711d]" />
      </div>
    );
  }

  const bibleData = bible;

  function bibleField(key: keyof ProjectBible): string {
    const value = bibleData[key];
    return typeof value === 'string' ? value : '';
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-room md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">
              <BookOpen className="h-4 w-4" /> Project Bible
            </div>
            <h1 className="mt-2 font-serif text-4xl font-semibold text-[#171a22]">{project?.title}</h1>
            <p className="mt-2 text-sm text-muted">Living memory for premise, wounds, structure and style rules.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="btn-primary">
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Project Bible
            </button>
            <Link to={`/projects/${id}`} className="btn-secondary">Back to project</Link>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { key: 'premise', label: 'Premise', multiline: true },
          { key: 'genre', label: 'Genre' },
          { key: 'tone', label: 'Tone' },
          { key: 'intendedAudience', label: 'Intended audience' },
          { key: 'setting', label: 'Setting' },
          { key: 'structure', label: 'Structure', multiline: true },
          { key: 'formatDecision', label: 'Format decision' },
          { key: 'characterWoundMap', label: 'Character / wound map', multiline: true },
          { key: 'sourceNotes', label: 'Source notes', multiline: true },
        ].map((field) => (
          <label key={field.key} className={`block rounded-[1.6rem] border border-[#eadfca] bg-white/85 p-4 shadow-paper ${field.multiline ? 'md:col-span-2' : ''}`}>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">{field.label}</span>
            {field.multiline ? (
              <textarea
                defaultValue={bibleField(field.key as keyof ProjectBible)}
                onBlur={(e) => saveMutation.mutate({ [field.key]: e.target.value })}
                className="mt-2 min-h-[120px] w-full rounded-2xl border border-[#eee3d0] bg-[#fffdf8] p-3 text-sm leading-7 outline-none focus:border-[#caa044]"
              />
            ) : (
              <input
                defaultValue={bibleField(field.key as keyof ProjectBible)}
                onBlur={(e) => saveMutation.mutate({ [field.key]: e.target.value })}
                className="mt-2 w-full rounded-2xl border border-[#eee3d0] bg-[#fffdf8] px-3 py-2 text-sm outline-none focus:border-[#caa044]"
              />
            )}
          </label>
        ))}
      </div>

      <section className="rounded-[1.8rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper">
        <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Scene / chapter plan</h2>
        <ul className="mt-3 space-y-2 text-sm leading-7 text-[#3d352b]">
          {(bibleData.scenePlan.length ? bibleData.scenePlan : ['No scene plan yet — run Novel Write Pro or generate bible']).map((beat) => (
            <li key={beat} className="rounded-xl bg-[#fffdf8] px-3 py-2">{beat}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-[1.8rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper">
        <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Active style rules</h2>
        <ul className="mt-3 space-y-2 text-sm leading-7 text-[#3d352b]">
          {(bibleData.styleRules.length ? bibleData.styleRules : ['Style rules populate after Novel Write Pro or bible generation']).map((rule) => (
            <li key={rule} className="rounded-xl bg-[#fffdf8] px-3 py-2">{rule}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-[1.8rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">
          <Wand2 className="h-4 w-4" /> Last generated outputs
        </div>
        {outputs.length === 0 ? (
          <p className="text-sm text-muted">No outputs yet.</p>
        ) : (
          <div className="space-y-2">
            {(outputs as Array<{ id: string; title: string; type: string }>).slice(0, 8).map((output) => (
              <Link key={output.id} to={`/outputs/${output.id}`} className="block rounded-xl border border-[#eadfca] bg-[#fffdf8] px-3 py-2 text-sm hover:border-[#caa044]">
                {output.title} <span className="text-muted">· {output.type}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Cloud, Loader2, Sparkles } from 'lucide-react';
import { getProviders } from '../api/assistant';
import { cn } from '../lib/utils';

interface ProviderStatusProps {
  compact?: boolean;
  className?: string;
}

function providerLabel(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes('openai')) return 'OpenAI';
  if (normalized.includes('anthropic') || normalized.includes('claude')) return 'Claude';
  if (normalized.includes('gemini') || normalized.includes('google')) return 'Gemini';
  if (normalized.includes('grok') || normalized.includes('xai')) return 'Grok';
  if (normalized.includes('ollama')) return 'Ollama';
  return name;
}

export function ProviderStatus({ compact = false, className }: ProviderStatusProps) {
  const { data: providers = [], isLoading, isError } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: getProviders,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const available = providers.filter((provider) => provider.available);
  const cloudProviders = available.filter((provider) => !provider.isLocal);
  const localProviders = available.filter((provider) => provider.isLocal);
  const readyCount = available.length;

  if (compact) {
    return (
      <div className={cn('inline-flex items-center gap-2 rounded-full border border-[#eadfca] bg-white/80 px-3 py-1.5 text-xs font-semibold text-muted shadow-sm', className)}>
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#98711d]" /> : <span className={cn('h-2 w-2 rounded-full', readyCount ? 'bg-emerald-500' : 'bg-amber-400')} />}
        <span>{readyCount ? `${readyCount} AI ${readyCount === 1 ? 'engine' : 'engines'} ready` : isError ? 'AI status unknown' : 'AI standby'}</span>
      </div>
    );
  }

  return (
    <div className={cn('rounded-[1.8rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">
            <Sparkles className="h-4 w-4" /> AI Engines
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            {readyCount
              ? 'Keys and local Ollama are configured. If writing fails, check billing, quotas, or pull a local model with ollama pull mistral.'
              : 'No configured AI engine is reporting ready yet.'}
          </p>
        </div>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#98711d]" /> : <Cloud className="h-5 w-5 text-[#98711d]" />}
      </div>

      <div className="flex flex-wrap gap-2">
        {providers.length === 0 && !isLoading ? (
          <span className="badge">No providers returned</span>
        ) : (
          providers.map((provider) => (
            <span
              key={`${provider.name}-${provider.isLocal ? 'local' : 'cloud'}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
                provider.available
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-[#eadfca] bg-[#fff8e8] text-[#8a7657]',
              )}
              title={provider.isLocal ? 'Local model/provider' : 'Cloud provider configured via server environment'}
            >
              <span className={cn('h-2 w-2 rounded-full', provider.available ? 'bg-emerald-500' : 'bg-amber-400')} />
              {providerLabel(provider.name)}
            </span>
          ))
        )}
      </div>

      <div className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-2">
        <div className="rounded-2xl bg-[#fffdf8] p-3">
          <strong className="text-[#171a22]">Cloud:</strong> {cloudProviders.length || 'none ready'}
        </div>
        <div className="rounded-2xl bg-[#fffdf8] p-3">
          <strong className="text-[#171a22]">Local:</strong> {localProviders.length || 'none ready'}
        </div>
      </div>
    </div>
  );
}

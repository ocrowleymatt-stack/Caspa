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

function statusLabel(status?: string): string {
  switch (status) {
    case 'ready': return 'Ready';
    case 'quota_failed': return 'Quota / billing';
    case 'auth_failed': return 'Auth failed';
    case 'model_missing': return 'Model missing';
    case 'unreachable': return 'Unreachable';
    case 'configured': return 'Configured';
    case 'not_configured': return 'Not configured';
    default: return 'Unknown';
  }
}

export function ProviderStatus({ compact = false, className }: ProviderStatusProps) {
  const { data: providers = [], isLoading, isError } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: getProviders,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const ready = providers.filter((p) => p.canGenerate ?? p.available);
  const ollama = providers.find((p) => p.name.toLowerCase().includes('ollama'));
  const readyCount = ready.length;

  if (compact) {
    return (
      <div className={cn('inline-flex items-center gap-2 rounded-full border border-[#eadfca] bg-white/80 px-3 py-1.5 text-xs font-semibold text-muted shadow-sm', className)}>
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#98711d]" /> : <span className={cn('h-2 w-2 rounded-full', readyCount ? 'bg-emerald-500' : 'bg-amber-400')} />}
        <span>
          {readyCount
            ? `${readyCount} engine${readyCount === 1 ? '' : 's'} ready`
            : ollama?.status === 'quota_failed' || providers.some((p) => p.status === 'quota_failed')
              ? 'Cloud quota blocked — check Ollama'
              : isError
                ? 'AI status unknown'
                : 'No engine can generate'}
        </span>
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
              ? 'At least one engine can generate right now. Ollama is the first-class local fallback.'
              : 'No engine can generate yet. Ollama should be ready locally; cloud failures below explain billing, auth, or model issues.'}
          </p>
        </div>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#98711d]" /> : <Cloud className="h-5 w-5 text-[#98711d]" />}
      </div>

      <div className="space-y-2">
        {providers.length === 0 && !isLoading ? (
          <span className="badge">No providers returned</span>
        ) : (
          providers.map((provider) => {
            const canGenerate = provider.canGenerate ?? provider.available;
            return (
              <div
                key={`${provider.name}-${provider.isLocal ? 'local' : 'cloud'}`}
                className={cn(
                  'rounded-2xl border px-3 py-2 text-xs',
                  canGenerate
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-[#eadfca] bg-[#fff8e8] text-[#5f5648]',
                )}
              >
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className={cn('h-2 w-2 rounded-full', canGenerate ? 'bg-emerald-500' : 'bg-amber-400')} />
                  {providerLabel(provider.name)}
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                    {statusLabel(provider.status)}
                  </span>
                  {provider.model && <span className="font-mono text-[10px]">{provider.model}</span>}
                </div>
                {provider.detail && (
                  <p className="mt-1 text-[11px] leading-5 opacity-90">{provider.detail}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

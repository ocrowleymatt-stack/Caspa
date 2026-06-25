import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, Download, ListMusic, Loader2, Newspaper, Package, Sparkles } from 'lucide-react';
import { listProjects } from '../api/projects';
import { listShowPackages } from '../api/showFactory';
import {
  assessProject,
  createCueList,
  downloadAsset,
  downloadCueListPdf,
  generateMarketingCopy,
  generatePitchDeck,
  generatePressKit,
  generateSocialPack,
  getCueList,
  getLatestReport,
  updateCue,
} from '../api/showBox';
import { useAppStore } from '../store';
import { copyToClipboard } from '../lib/utils';
import { useToast } from '../components/Toast';
import type {
  CommercialReadinessReport,
  Cue,
  CueList,
  MarketingCopyPack,
  SocialMediaPack,
} from '../types';

type Tab = 'assessment' | 'marketing' | 'social' | 'pitch' | 'press' | 'cues';

export default function ShowInABox() {
  const toast = useToast();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const [projectId, setProjectId] = useState(activeProjectId ?? '');
  const [tab, setTab] = useState<Tab>('assessment');
  const [report, setReport] = useState<CommercialReadinessReport | null>(null);
  const [marketing, setMarketing] = useState<MarketingCopyPack | null>(null);
  const [social, setSocial] = useState<SocialMediaPack | null>(null);
  const [cueList, setCueList] = useState<CueList | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [editingCue, setEditingCue] = useState<Cue | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const { data: showPackages = [] } = useQuery({
    queryKey: ['show-packages', projectId],
    queryFn: () => listShowPackages(projectId),
    enabled: !!projectId,
  });

  useQuery({
    queryKey: ['show-box-report', projectId],
    queryFn: async () => {
      const r = await getLatestReport(projectId);
      if (r) setReport(r);
      return r;
    },
    enabled: !!projectId,
  });

  const assessMutation = useMutation({
    mutationFn: () => assessProject(projectId),
    onSuccess: (r) => {
      setReport(r);
      toast.success('Assessment complete');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const marketingMutation = useMutation({
    mutationFn: () => generateMarketingCopy(projectId),
    onSuccess: (r) => {
      setMarketing(r);
      toast.success('Marketing copy generated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const socialMutation = useMutation({
    mutationFn: () => generateSocialPack(projectId),
    onSuccess: (r) => {
      setSocial(r);
      toast.success('Social pack generated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pitchMutation = useMutation({
    mutationFn: () => generatePitchDeck(projectId),
    onSuccess: () => toast.success('Pitch deck generated'),
    onError: (err: Error) => toast.error(err.message),
  });

  const pressMutation = useMutation({
    mutationFn: () => generatePressKit(projectId),
    onSuccess: () => toast.success('Press kit generated'),
    onError: (err: Error) => toast.error(err.message),
  });

  const cueListMutation = useMutation({
    mutationFn: () => createCueList(selectedPackageId),
    onSuccess: (list) => {
      setCueList(list);
      toast.success('Cue list created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateCueMutation = useMutation({
    mutationFn: ({ cueId, data }: { cueId: string; data: Partial<Cue> }) =>
      updateCue(cueList!.id, cueId, data),
    onSuccess: async () => {
      if (cueList) {
        const refreshed = await getCueList(cueList.id);
        setCueList(refreshed);
      }
      setEditingCue(null);
      toast.success('Cue updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    toast.success('Copied to clipboard');
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'assessment', label: 'Assessment' },
    { id: 'marketing', label: 'Marketing Copy' },
    { id: 'social', label: 'Social Pack' },
    { id: 'pitch', label: 'Pitch Deck' },
    { id: 'press', label: 'Press Kit' },
    { id: 'cues', label: 'Cue Lists' },
  ];

  const busy =
    assessMutation.isPending ||
    marketingMutation.isPending ||
    socialMutation.isPending ||
    pitchMutation.isPending ||
    pressMutation.isPending ||
    cueListMutation.isPending;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-7 w-7 text-accent" /> Show In A Box
        </h1>
        <p className="text-muted text-sm mt-1">Commercial readiness, marketing, and launch materials</p>
      </div>

      <div className="card">
        <label className="label">Project</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input max-w-md">
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 border-b border-white/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!projectId ? (
        <p className="text-muted text-center py-12">Select a project to get started</p>
      ) : (
        <div className="card">
          {tab === 'assessment' && (
            <div className="space-y-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => assessMutation.mutate()}
                className="btn-primary"
              >
                {assessMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Run Assessment
              </button>
              {report && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold text-accent">{report.overallScore}</div>
                    <div>
                      <p className="font-medium">Overall Score</p>
                      <p className="text-xs text-muted">Generated {new Date(report.generatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(report.categories).map(([key, value]) => (
                      <div key={key} className="rounded-lg bg-white/5 p-3">
                        <p className="text-xs text-muted capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <p className="text-lg font-semibold">{value}%</p>
                      </div>
                    ))}
                  </div>
                  {report.recommendations.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2">Recommendations</h3>
                      <ul className="space-y-1 text-sm text-muted">
                        {report.recommendations.map((r, i) => (
                          <li key={i}>• {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {report.blockers.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2 text-red-400">Blockers</h3>
                      <ul className="space-y-1 text-sm text-red-300/80">
                        {report.blockers.map((b, i) => (
                          <li key={i}>• {b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'marketing' && (
            <div className="space-y-4">
              <button type="button" disabled={busy} onClick={() => marketingMutation.mutate()} className="btn-primary">
                {marketingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Marketing Copy'}
              </button>
              {marketing && (
                <div className="space-y-4 text-sm">
                  {[
                    ['Tagline', marketing.tagline],
                    ['100-word Blurb', marketing.blurb100],
                    ['50-word Blurb', marketing.blurb50],
                    ['Amazon Description', marketing.amazonDescription],
                    ['Author Bio', marketing.authorBio],
                    ['Target Audience', marketing.targetAudience],
                  ].map(([label, text]) => (
                    <div key={label} className="rounded-lg bg-white/5 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{label}</h3>
                        <button type="button" onClick={() => handleCopy(text)} className="btn-ghost p-1">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-muted whitespace-pre-wrap">{text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'social' && (
            <div className="space-y-4">
              <button type="button" disabled={busy} onClick={() => socialMutation.mutate()} className="btn-primary">
                {socialMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Social Pack'}
              </button>
              {social && (
                <div className="space-y-4 text-sm">
                  {social.tweets.map((tweet, i) => (
                    <div key={i} className="rounded-lg bg-white/5 p-4 flex justify-between gap-3">
                      <p className="text-muted">{tweet}</p>
                      <button type="button" onClick={() => handleCopy(tweet)} className="btn-ghost p-1 shrink-0">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="rounded-lg bg-white/5 p-4">
                    <div className="flex justify-between mb-2">
                      <h3 className="font-medium">Launch Day Post</h3>
                      <button type="button" onClick={() => handleCopy(social.launchDayPost)} className="btn-ghost p-1">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-muted">{social.launchDayPost}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {social.hashtags.map((h) => (
                      <span key={h} className="badge bg-accent/10 text-accent">{h}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'pitch' && (
            <div className="space-y-4">
              <button type="button" disabled={busy} onClick={() => pitchMutation.mutate()} className="btn-primary">
                {pitchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Pitch Deck'}
              </button>
              <button
                type="button"
                disabled={!projectId}
                onClick={() =>
                  downloadAsset('pitch-deck', projectId).catch((e: Error) => toast.error(e.message))
                }
                className="btn-secondary ml-2"
              >
                <Download className="h-4 w-4" /> Download PDF
              </button>
              <p className="text-sm text-muted">
                Generates a pitch deck with synopsis, market analysis, and production overview.
              </p>
            </div>
          )}

          {tab === 'press' && (
            <div className="space-y-4">
              <button type="button" disabled={busy} onClick={() => pressMutation.mutate()} className="btn-primary">
                {pressMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Newspaper className="h-4 w-4" />
                )}
                Generate Press Kit
              </button>
              <button
                type="button"
                disabled={!projectId}
                onClick={() =>
                  downloadAsset('press-kit', projectId).catch((e: Error) => toast.error(e.message))
                }
                className="btn-secondary ml-2"
              >
                <Download className="h-4 w-4" /> Download
              </button>
              <p className="text-sm text-muted">
                Creates a press kit with synopsis, author bio, and media-ready materials.
              </p>
            </div>
          )}

          {tab === 'cues' && (
            <div className="space-y-4">
              <div>
                <label className="label">Show Package</label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  className="input max-w-md"
                >
                  <option value="">Select show package...</option>
                  {showPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.title} ({pkg.type})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={!selectedPackageId || cueListMutation.isPending}
                onClick={() => cueListMutation.mutate()}
                className="btn-primary"
              >
                {cueListMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ListMusic className="h-4 w-4" />
                )}
                Create Cue List
              </button>
              {cueList && (
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{cueList.title}</h3>
                    <button
                      type="button"
                      onClick={() =>
                        downloadCueListPdf(cueList.id).catch((e: Error) => toast.error(e.message))
                      }
                      className="btn-secondary text-xs"
                    >
                      <Download className="h-3.5 w-3.5" /> Download PDF
                    </button>
                  </div>
                  {cueList.cues.map((cue) => (
                    <div key={cue.id} className="rounded-lg bg-white/5 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted font-mono">#{cue.order}</span>
                          <span className="font-medium">{cue.label}</span>
                          <span className="badge bg-accent/10 text-accent text-[10px] capitalize">
                            {cue.type}
                          </span>
                          <span className="badge bg-white/5 text-muted text-[10px]">{cue.timing}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingCue(cue)}
                          className="btn-secondary text-xs py-1"
                        >
                          Edit
                        </button>
                      </div>
                      <p className="text-muted mt-1 text-xs">Trigger: {cue.triggerText}</p>
                      <p className="text-muted mt-1">{cue.instruction}</p>
                    </div>
                  ))}
                </div>
              )}
              {showPackages.length === 0 && (
                <p className="text-sm text-muted">Generate a show pack in Show Factory first.</p>
              )}
            </div>
          )}
        </div>
      )}

      {editingCue && cueList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md space-y-4">
            <h3 className="font-semibold">Edit Cue: {editingCue.label}</h3>
            <div>
              <label className="label">Label</label>
              <input
                value={editingCue.label}
                onChange={(e) => setEditingCue({ ...editingCue, label: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Instruction</label>
              <textarea
                value={editingCue.instruction}
                onChange={(e) => setEditingCue({ ...editingCue, instruction: e.target.value })}
                className="input min-h-[80px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingCue(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                disabled={updateCueMutation.isPending}
                onClick={() =>
                  updateCueMutation.mutate({
                    cueId: editingCue.id,
                    data: { label: editingCue.label, instruction: editingCue.instruction },
                  })
                }
                className="btn-primary"
              >
                {updateCueMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

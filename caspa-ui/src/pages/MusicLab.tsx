import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Download, Loader2, Moon, Music, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import { listProjects } from '../api/projects';
import { listChapters } from '../api/chapters';
import {
  cancelOvernightSchedule,
  createTrack,
  deleteTrack,
  generateAtmosphericPack,
  generateChapterTheme,
  listOvernightSchedules,
  listTracks,
  scheduleOvernight,
} from '../api/musicLab';
import { useAppStore } from '../store';
import { formatDate } from '../lib/utils';
import { useToast } from '../components/Toast';
import { JobProgressCard } from '../components/JobProgressCard';
import type { JobStatus, MusicTrack } from '../types';

async function playSynthPreview(track: Pick<MusicTrack, 'tempo' | 'mood' | 'genre' | 'title'>) {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) throw new Error('This browser cannot play the built-in WebAudio demo synth.');

  const ctx = new AudioContextClass();
  const master = ctx.createGain();
  master.gain.value = 0.16;
  master.connect(ctx.destination);

  const bpm = Math.max(55, Math.min(180, track.tempo || 110));
  const beat = 60 / bpm;
  const now = ctx.currentTime;

  const palettes: Record<string, number[]> = {
    melancholic: [220.0, 261.63, 293.66, 349.23, 329.63, 293.66, 261.63, 220.0],
    triumphant: [261.63, 329.63, 392.0, 523.25, 659.25, 523.25, 392.0, 329.63],
    tense: [196.0, 207.65, 233.08, 261.63, 277.18, 261.63, 233.08, 207.65],
    peaceful: [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66],
    mysterious: [220.0, 246.94, 261.63, 311.13, 349.23, 311.13, 261.63, 246.94],
  };

  const melody = palettes[track.mood] || palettes.mysterious;
  const bass = [melody[0] / 2, melody[3] / 2, melody[4] / 2, melody[1] / 2];

  melody.concat(melody.slice().reverse()).forEach((freq, index) => {
    const start = now + index * beat;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = track.genre === 'ambient' ? 'triangle' : 'sawtooth';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + beat * 0.86);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + beat * 0.95);
  });

  bass.forEach((freq, index) => {
    const start = now + index * beat * 4;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + beat * 3.4);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + beat * 3.7);
  });

  window.setTimeout(() => void ctx.close(), Math.max(5000, beat * 17000));
}

function makeMusicExportBlock(track: Pick<MusicTrack, 'title' | 'genre' | 'mood' | 'tempo' | 'duration' | 'sunoPrompt'>) {
  return `# Music Export Block

Title: ${track.title}
Genre: ${track.genre}
Mood: ${track.mood}
Tempo: ${track.tempo} BPM
Duration: ${track.duration}s

## Structure
Intro: 4 bars
A theme: 8 bars
B lift: 8 bars
Return: 8 bars
Button / sting: 2 bars

## Prompt / production brief
${track.sunoPrompt || `${track.genre} ${track.mood} instrumental theme, ${track.tempo} BPM, cinematic literary soundtrack, clear motif, emotional movement, polished demo quality`}
`;
}

export default function MusicLab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const [projectId, setProjectId] = useState(activeProjectId ?? '');
  const [chapterId, setChapterId] = useState('');
  const [mood, setMood] = useState('melancholic');
  const [tempo, setTempo] = useState(90);
  const [overnightEnabled, setOvernightEnabled] = useState(false);
  const [startHour, setStartHour] = useState(2);
  const [trackCount, setTrackCount] = useState(5);
  const [packJob, setPackJob] = useState<JobStatus | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [exportBlock, setExportBlock] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => listChapters(projectId),
    enabled: !!projectId,
  });

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ['tracks', projectId],
    queryFn: () => listTracks(projectId || undefined),
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['overnight-schedules'],
    queryFn: listOvernightSchedules,
  });

  const generateChapterMutation = useMutation({
    mutationFn: () => generateChapterTheme(chapterId),
    onSuccess: (track) => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      setExportBlock(makeMusicExportBlock(track));
      toast.success('Chapter theme generated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const generatePackMutation = useMutation({
    mutationFn: () => generateAtmosphericPack(projectId),
    onMutate: () => {
      setPackJob({
        id: 'pack-gen',
        type: 'music-lab:atmospheric-pack',
        status: 'running',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: (tracks) => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      setPackJob((j) => j ? { ...j, status: 'complete', progress: 100 } : null);
      setExportBlock(tracks[0] ? makeMusicExportBlock(tracks[0]) : 'Atmospheric pack generated.');
      toast.success('Atmospheric pack generated');
      setTimeout(() => setPackJob(null), 3000);
    },
    onError: (err: Error) => {
      setPackJob((j) =>
        j ? { ...j, status: 'failed', error: err.message } : null,
      );
      toast.error(err.message);
    },
  });

  const createTrackMutation = useMutation({
    mutationFn: () =>
      createTrack({
        genre: 'ambient',
        mood,
        tempo,
        duration: 180,
        projectId: projectId || undefined,
        title: `${mood} theme`,
      }),
    onSuccess: (track) => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      setExportBlock(makeMusicExportBlock(track));
      toast.success('Track created with playable browser preview');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const scheduleMutation = useMutation({
    mutationFn: () =>
      scheduleOvernight({ projectId, trackCount, startHour }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overnight-schedules'] });
      toast.success('Overnight schedule created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteTrackMutation = useMutation({
    mutationFn: deleteTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      toast.success('Track deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelScheduleMutation = useMutation({
    mutationFn: cancelOvernightSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overnight-schedules'] });
      toast.success('Schedule cancelled');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function playTrack(track: MusicTrack) {
    try {
      setPreviewingId(track.id);
      if (track.filePath) {
        const audio = new Audio(track.filePath);
        audio.onended = () => setPreviewingId(null);
        await audio.play();
        return;
      }
      await playSynthPreview(track);
      window.setTimeout(() => setPreviewingId(null), 8000);
    } catch (err) {
      setPreviewingId(null);
      toast.error(err instanceof Error ? err.message : 'Could not play preview');
    }
  }

  async function playCurrentSettings() {
    const temp: MusicTrack = {
      id: 'preview-current',
      title: `${mood} ${tempo} BPM preview`,
      genre: 'ambient',
      mood,
      tempo,
      duration: 24,
      generatedAt: new Date().toISOString(),
      projectId: projectId || undefined,
    };
    setExportBlock(makeMusicExportBlock(temp));
    await playTrack(temp);
  }

  async function copyExportBlock() {
    if (!exportBlock) return;
    await navigator.clipboard.writeText(exportBlock);
    toast.success('Music export block copied');
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Music className="h-7 w-7 text-accent" /> Music Lab
        </h1>
        <p className="text-muted text-sm mt-1">
          Generate themes, leitmotifs and atmospheric tracks. Prompts are now secondary: the play buttons create an immediate browser synth preview.
        </p>
      </div>

      <div className="card border-accent/30 bg-accent/5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" /> Instant playable demo
            </h2>
            <p className="text-sm text-muted mt-1">
              Use this when you want to hear something now. It is a simple WebAudio sketch, not a final studio render.
            </p>
          </div>
          <button type="button" onClick={playCurrentSettings} disabled={previewingId !== null} className="btn-primary">
            {previewingId === 'preview-current' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Play current mood/tempo
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4">
          <h2 className="font-semibold">Generate Chapter Theme</h2>
          <div>
            <label className="label">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input">
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Chapter</label>
            <select value={chapterId} onChange={(e) => setChapterId(e.target.value)} className="input" disabled={!projectId}>
              <option value="">Select chapter...</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mood</label>
              <select value={mood} onChange={(e) => setMood(e.target.value)} className="input">
                {['melancholic', 'triumphant', 'tense', 'peaceful', 'mysterious'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tempo (BPM)</label>
              <input type="number" value={tempo} onChange={(e) => setTempo(Number(e.target.value))} className="input" />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!chapterId || generateChapterMutation.isPending}
              onClick={() => generateChapterMutation.mutate()}
              className="btn-primary flex-1"
            >
              {generateChapterMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Theme'}
            </button>
            <button
              type="button"
              disabled={!projectId || createTrackMutation.isPending}
              onClick={() => createTrackMutation.mutate()}
              className="btn-secondary"
              title="Create track record"
            >
              {createTrackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={playCurrentSettings}
              disabled={previewingId !== null}
              className="btn-secondary"
              title="Play browser demo"
            >
              <Play className="h-4 w-4" />
            </button>
          </div>
          {projectId && (
            <>
              <button
                type="button"
                disabled={generatePackMutation.isPending}
                onClick={() => generatePackMutation.mutate()}
                className="btn-secondary w-full text-xs"
              >
                {generatePackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Full Atmospheric Pack'}
              </button>
              {packJob && <JobProgressCard job={packJob} compact />}
            </>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Moon className="h-5 w-5 text-accent" /> Overnight Schedule
          </h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={overnightEnabled}
              onChange={(e) => setOvernightEnabled(e.target.checked)}
              className="rounded border-white/20 bg-background text-accent focus:ring-accent"
            />
            <span className="text-sm">Enable overnight generation</span>
          </label>
          {overnightEnabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Hour (0-23)</label>
                  <input type="number" min={0} max={23} value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} className="input" />
                </div>
                <div>
                  <label className="label">Track Count</label>
                  <input type="number" min={1} max={20} value={trackCount} onChange={(e) => setTrackCount(Number(e.target.value))} className="input" />
                </div>
              </div>
              <button
                type="button"
                disabled={!projectId || scheduleMutation.isPending}
                onClick={() => scheduleMutation.mutate()}
                className="btn-primary w-full"
              >
                {scheduleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Schedule Run'}
              </button>
            </>
          )}
          {schedules.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              {schedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    {s.trackCount} tracks @ {s.startHour}:00
                  </span>
                  <button type="button" onClick={() => cancelScheduleMutation.mutate(s.id)} className="btn-ghost p-1 text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {exportBlock && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold flex items-center gap-2"><Download className="h-5 w-5 text-accent" /> Music material / export block</h2>
            <button type="button" onClick={copyExportBlock} className="btn-secondary text-xs">Copy</button>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-background/60 p-4 text-xs leading-5 text-muted">{exportBlock}</pre>
        </div>
      )}

      <div>
        <h2 className="font-semibold mb-4">Tracks</h2>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : tracks.length === 0 ? (
          <div className="card text-center py-12">
            <Music className="h-10 w-10 mx-auto text-muted mb-3 opacity-40" />
            <p className="text-muted">No tracks yet. Generate your first theme above or play an instant demo.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tracks.map((track) => (
              <div key={track.id} className="card flex items-center gap-4 py-3">
                <button
                  type="button"
                  onClick={() => playTrack(track)}
                  disabled={previewingId !== null}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-60"
                  title={track.filePath ? 'Play generated file' : 'Play browser synth preview'}
                >
                  {previewingId === track.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{track.title}</p>
                  <p className="text-xs text-muted capitalize">
                    {track.genre} · {track.mood} · {track.tempo} BPM · {track.duration}s {track.filePath ? '· audio file' : '· browser preview'}
                  </p>
                  <div className="mt-2 h-8 rounded bg-white/5 flex items-center px-2">
                    <div className="flex gap-0.5 items-end h-4">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-accent/40 rounded-sm"
                          style={{ height: `${20 + Math.sin(i * 0.5) * 12}px` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted shrink-0">{formatDate(track.generatedAt)}</p>
                <button type="button" onClick={() => setExportBlock(makeMusicExportBlock(track))} className="btn-ghost p-1 text-accent" title="Show export block">
                  <Download className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => deleteTrackMutation.mutate(track.id)} className="btn-ghost p-1 text-red-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import { CaspaShell } from "@/components/CaspaShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseCaspaError } from "@/lib/caspaError";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BookText, Check, FileText, FileUp, Library, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function Card({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="literary-card p-6 sm:p-8"><p className="eyebrow">{eyebrow}</p><h1 className="mt-2 text-4xl font-semibold">{title}</h1><div className="mt-6">{children}</div></section>;
}

export default function StyleLibraryPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const library = trpc.style.library.useQuery(undefined, { enabled: isAuthenticated });
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [content, setContent] = useState("");
  const [consent, setConsent] = useState(false);
  const [profileName, setProfileName] = useState("Private craft profile");
  const [selected, setSelected] = useState<number[]>([]);
  const uploadInput = useRef<HTMLInputElement>(null);
  const refresh = async () => { await utils.style.library.invalidate(); };
  const addSample = trpc.style.addSample.useMutation({ onSuccess: async () => { toast.success("Private style sample added."); setName(""); setTags(""); setSourceNote(""); setContent(""); setConsent(false); await refresh(); }, onError: error => toast.error(parseCaspaError(error, "The style sample could not be added.").message) });
  const createProfile = trpc.style.createProfile.useMutation({ onSuccess: async () => { toast.success("A non-identifying craft profile is ready."); setSelected([]); await refresh(); }, onError: error => toast.error(parseCaspaError(error, "CASPA could not prepare a private craft profile.").message) });
  const remove = trpc.style.deleteSample.useMutation({ onSuccess: refresh, onError: error => toast.error(parseCaspaError(error, "The sample could not be removed.").message) });
  const exportLibrary = trpc.style.exportLibrary.useMutation({ onSuccess: data => { const href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = href; link.download = "caspa-private-style-library.json"; link.click(); URL.revokeObjectURL(href); toast.success("Private style metadata exported. Source text remains private."); }, onError: error => toast.error(parseCaspaError(error, "Your private style library could not be exported.").message) });
  const profiles = library.data?.profiles || [];
  const samples = library.data?.samples || [];
  const selectedWordCount = useMemo(() => samples.filter(sample => selected.includes(sample.id)).reduce((sum, sample) => sum + sample.wordCount, 0), [samples, selected]);
  const loadTextSample = async (file: File | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".txt") && !lower.endsWith(".md")) { toast.error("Upload a UTF-8 .txt or .md style sample."); return; }
    if (file.size > 120_000) { toast.error("Keep a style sample below 120 KB."); return; }
    const text = await file.text();
    setContent(text);
    if (!name.trim()) setName(file.name.replace(/\.(txt|md)$/i, "").replace(/[-_]+/g, " "));
    toast.success("Private sample loaded. Review the text and consent before adding it.");
  };
  if (loading || library.isLoading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  if (!isAuthenticated) { setLocation("/"); return null; }
  return <CaspaShell><div className="container py-8 sm:py-10">
    <button type="button" onClick={() => setLocation("/")} className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-primary"><ArrowLeft className="size-3.5" /> All projects</button>
    <div className="mb-7 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="eyebrow">Private Style Library</p><h1 className="mt-2 text-5xl font-semibold tracking-tight sm:text-6xl">Your craft, described—not copied.</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">Add only work you own or are licensed to use. CASPA converts selected samples into a private, non-identifying craft profile that you may choose for a draft.</p></div><div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4 text-sm text-muted-foreground"><p className="font-semibold text-foreground">Consent before style</p><p className="mt-1 max-w-72 text-xs leading-5">No named-author imitation, no source excerpts in profile prompts, and one-click removal from your library.</p><Button size="sm" variant="outline" className="mt-3" disabled={exportLibrary.isPending} onClick={() => exportLibrary.mutate()}>{exportLibrary.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <BookText className="size-3.5" />} Export library record</Button></div></div>
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]"><Card eyebrow="Add a consented excerpt" title="Source sample"><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Sample name</Label><Input value={name} onChange={event => setName(event.target.value)} placeholder="Early chapter, dialogue scene…" className="bg-black/15" /></div><div className="space-y-2"><Label>Tags</Label><Input value={tags} onChange={event => setTags(event.target.value)} placeholder="spare, first-person, quiet" className="bg-black/15" /></div></div><div className="space-y-2"><Label>Source note <span className="text-muted-foreground">(private)</span></Label><Input value={sourceNote} onChange={event => setSourceNote(event.target.value)} placeholder="My unpublished novel, 2024" className="bg-black/15" /></div><div className="space-y-2"><div className="flex items-center justify-between gap-3"><Label>Excerpt</Label><input ref={uploadInput} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={event => { void loadTextSample(event.target.files?.[0]); event.currentTarget.value = ""; }} /><Button type="button" size="sm" variant="outline" onClick={() => uploadInput.current?.click()}><FileUp className="size-3.5" /> Upload .txt or .md</Button></div><Textarea value={content} onChange={event => setContent(event.target.value)} placeholder="Paste at least 80 words that you own or are licensed to use…" className="min-h-64 bg-black/15 font-serif leading-7" /></div><Label className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/[0.05] p-4 text-xs leading-5 text-muted-foreground"><Checkbox checked={consent} onCheckedChange={value => setConsent(Boolean(value))} /><span>I confirm that I own this text or have an explicit licence to use it for a private craft profile. I understand CASPA will not represent this as another author’s style.</span></Label><div className="flex justify-end"><Button disabled={!consent || name.trim().length < 2 || content.trim().length < 300 || addSample.isPending} onClick={() => addSample.mutate({ name: name.trim(), tags: tags.trim() || undefined, sourceNote: sourceNote.trim() || undefined, content: content.trim(), consentConfirmed: true })}>{addSample.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} Add private sample</Button></div></div></Card>
      <Card eyebrow="Select owned samples" title="Create a craft profile"><p className="text-sm leading-7 text-muted-foreground">A profile contains transferable craft dimensions—rhythm, pacing, point of view, imagery, and register—not copied language.</p><div className="mt-5 space-y-2">{samples.length ? samples.map(sample => <label key={sample.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${selected.includes(sample.id) ? "border-primary/45 bg-primary/[0.06]" : "border-border bg-black/10"}`}><Checkbox checked={selected.includes(sample.id)} onCheckedChange={value => setSelected(current => value ? Array.from(new Set([...current, sample.id])) : current.filter(id => id !== sample.id))} /><span className="min-w-0 flex-1"><span className="flex justify-between gap-3"><strong className="truncate text-sm">{sample.name}</strong><span className="text-xs text-muted-foreground">{sample.wordCount.toLocaleString()} words</span></span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{sample.tags || "No tags"}{sample.sourceNote ? ` · ${sample.sourceNote}` : ""}</span></span><button type="button" className="text-muted-foreground hover:text-destructive" onClick={event => { event.preventDefault(); remove.mutate({ sampleId: sample.id, authorConfirmed: true }); }} aria-label={`Delete ${sample.name}`}><Trash2 className="size-4" /></button></label>) : <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Your private library is empty.</div>}</div><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"><Input value={profileName} onChange={event => setProfileName(event.target.value)} className="bg-black/15" placeholder="Profile name" /><Button disabled={!selected.length || createProfile.isPending} onClick={() => createProfile.mutate({ name: profileName.trim() || "Private craft profile", sampleIds: selected })}>{createProfile.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Build profile</Button></div><p className="mt-2 text-xs text-muted-foreground">{selected.length} sample{selected.length === 1 ? "" : "s"} · {selectedWordCount.toLocaleString()} words selected</p></Card></div>
    <section className="mt-5 literary-card p-6 sm:p-8"><p className="eyebrow">Available to Draft with CASPA</p><h2 className="mt-2 text-4xl font-semibold">Private craft profiles</h2><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{profiles.length ? profiles.map(profile => { const dimensions = JSON.parse(profile.dimensionsJson) as Record<string, string>; return <div key={profile.id} className="rounded-xl border border-border bg-black/10 p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-display text-2xl font-semibold">{profile.name}</h3><span className="rounded-full border border-primary/20 bg-primary/8 px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-primary">{profile.status}</span></div><dl className="mt-4 space-y-2 text-xs leading-5 text-muted-foreground">{Object.entries(dimensions).map(([key, value]) => <div key={key}><dt className="inline font-semibold text-foreground">{key.replace(/([A-Z])/g, " $1")}: </dt><dd className="inline">{value}</dd></div>)}</dl><p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{profile.cautions}</p></div>; }) : <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">Profiles will appear after you select consented samples.</div>}</div></section>
  </div></CaspaShell>;
}

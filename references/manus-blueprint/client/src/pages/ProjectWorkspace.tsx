import { useAuth } from "@/_core/hooks/useAuth";
import { CaspaShell } from "@/components/CaspaShell";
import { WorkflowRail } from "@/components/WorkflowRail";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { downloadTextFile, parseCaspaError } from "@/lib/caspaError";
import { trpc } from "@/lib/trpc";
import { canPerformAction, nextGuidedAction, STATE_LABELS, type ProjectState, type WorkflowAction } from "@shared/workflow";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  BookCheck,
  BookOpenText,
  Check,
  ChevronRight,
  CircleDashed,
  Download,
  FileClock,
  FileUp,
  Gauge,
  GitCompareArrows,
  History,
  Loader2,
  LockKeyhole,
  Play,
  RotateCcw,
  Save,
  ScanSearch,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Undo2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type WorkspaceView = "overview" | "draft" | "manuscript" | "diagnosis" | "revision" | "versions" | "export";
type DraftMode = "opening" | "append-chapter" | "replace-chapter";

const ACTION_COPY: Record<WorkflowAction, { label: string; detail: string }> = {
  "edit-manuscript": { label: "Edit manuscript", detail: "Create a new named manuscript snapshot." },
  "draft-manuscript": { label: "Draft with CASPA", detail: "Ground a chapter draft in your premise, outline, and existing manuscript before choosing whether to save it." },
  "run-diagnosis": { label: "Diagnose the draft", detail: "Run the explicit editorial rubric against the saved manuscript." },
  "approve-plan": { label: "Approve a revision plan", detail: "Choose the findings and scope before CASPA changes any text." },
  "start-revision": { label: "Start revision", detail: "Create a resumable, chapter-checkpointed server job." },
  "review-revision": { label: "Review the revision", detail: "Inspect the result and accept it before export checks begin." },
  "run-preflight": { label: "Run export preflight", detail: "Validate completeness, structure, metadata, and target length." },
  "download-export": { label: "Download manuscript", detail: "The server has cleared the active version for export." },
  "start-art-direction": { label: "Begin book production", detail: "Set the visual direction for the cover, illustrations, and interior edition." },
  "edit-art-brief": { label: "Refine the art brief", detail: "Tune audience, tone, motifs, palette, medium, and typography direction." },
  "generate-cover": { label: "Develop cover concepts", detail: "Generate versioned cover art directions with exact title-safe composition." },
  "approve-cover": { label: "Approve a cover", detail: "Select one cover concept before interior layout begins." },
  "approve-illustrations": { label: "Approve illustration assets", detail: "Review every planned image or explicitly waive it." },
  "approve-art-program": { label: "Approve the visual program", detail: "Lock the cover and illustration choices for layout." },
  "compose-layout": { label: "Compose the interior", detail: "Create a deterministic, versioned page layout from approved assets." },
  "submit-proof": { label: "Open proof review", detail: "Review the composed pages and annotate the exact layout version." },
  "resolve-proof": { label: "Resolve proof notes", detail: "Close or defer every author annotation before production preflight." },
  "run-production-preflight": { label: "Run production preflight", detail: "Validate cover, assets, pagination, metadata, accessibility, and proof approval." },
  "download-production": { label: "Download production package", detail: "The latest approved proof is cleared for print and digital packages." },
  "restore-version": { label: "Restore a version", detail: "Create a new snapshot from an earlier manuscript version." },
  archive: { label: "Archive project", detail: "Move the project out of the active writing desk." },
  "restore-archive": { label: "Restore project", detail: "Return this archived work to draft state." },
};

function stateDefaultView(state: ProjectState): WorkspaceView {
  if (state === "draft") return "draft";
  if (state === "diagnosed") return "diagnosis";
  if (["plan-approved", "revision-running", "review"].includes(state)) return "revision";
  if (state === "export-ready") return "export";
  return "overview";
}

function viewAvailability(state: ProjectState): Record<WorkspaceView, boolean> {
  const reachedDiagnosis = !["draft", "archived"].includes(state);
  const reachedRevision = !["draft", "diagnosed", "archived"].includes(state);
  const reachedExport = ["review", "export-ready", "art-direction", "art-approved", "layout", "proof-review", "production-ready"].includes(state);
  return {
    overview: true,
    draft: state === "draft",
    manuscript: state !== "archived",
    diagnosis: reachedDiagnosis,
    revision: reachedRevision,
    versions: true,
    export: reachedExport,
  };
}

function wordProgress(words: number, target: number) {
  return target > 0 ? Math.min(100, Math.round((words / target) * 100)) : 0;
}

function fileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File reading failed"));
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

function WorkspaceCard({ eyebrow, title, children, aside }: { eyebrow: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="literary-card p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div><p className="eyebrow">{eyebrow}</p><h2 className="mt-2 text-4xl font-semibold">{title}</h2></div>
        {aside}
      </div>
      <div className="mt-7">{children}</div>
    </section>
  );
}

export default function ProjectWorkspace() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const projectId = Number(params?.id || 0);
  const utils = trpc.useUtils();
  const workspace = trpc.projects.get.useQuery({ projectId }, { enabled: isAuthenticated && projectId > 0 });
  const state = (workspace.data?.project.currentState || "draft") as ProjectState;
  const diagnosis = trpc.workshop.latest.useQuery({ projectId }, { enabled: Boolean(workspace.data) && state !== "draft" });
  const plan = trpc.revisions.latestPlan.useQuery({ projectId }, { enabled: Boolean(workspace.data) && ["plan-approved", "revision-running", "review", "export-ready"].includes(state) });
  const jobId = plan.data?.job?.id || 0;
  const jobStatus = trpc.revisions.status.useQuery({ jobId }, {
    enabled: jobId > 0,
    refetchInterval: state === "revision-running" ? 2400 : false,
  });
  const [view, setView] = useState<WorkspaceView>("overview");
  const [manuscript, setManuscript] = useState("");
  const [selectedFindings, setSelectedFindings] = useState<number[]>([]);
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "major" | "moderate" | "minor">("all");
  const [selectionFilter, setSelectionFilter] = useState<"all" | "selected" | "unselected">("all");
  const [scope, setScope] = useState<"whole-book" | "chapter-range" | "single-chapter">("whole-book");
  const [startChapter, setStartChapter] = useState(1);
  const [endChapter, setEndChapter] = useState(1);
  const [planConfirmed, setPlanConfirmed] = useState(false);
  const [revisionStyleProfileId, setRevisionStyleProfileId] = useState(0);
  const [revisionConfirmed, setRevisionConfirmed] = useState(false);
  const [leftVersionId, setLeftVersionId] = useState(0);
  const [rightVersionId, setRightVersionId] = useState(0);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [draftMode, setDraftMode] = useState<DraftMode>("opening");
  const [draftTitle, setDraftTitle] = useState("Opening chapter");
  const [draftChapterNumber, setDraftChapterNumber] = useState(1);
  const [draftTargetWords, setDraftTargetWords] = useState(900);
  const [draftOutline, setDraftOutline] = useState("");
  const [draftVoiceNotes, setDraftVoiceNotes] = useState("");
  const [draftExclusions, setDraftExclusions] = useState("");
  const [draftStyleProfileId, setDraftStyleProfileId] = useState(0);
  const [draftAccepted, setDraftAccepted] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const comparison = trpc.versions.compare.useQuery({ leftVersionId, rightVersionId }, { enabled: leftVersionId > 0 && rightVersionId > 0 && leftVersionId !== rightVersionId });
  const latestPreflight = trpc.exports.latestPreflight.useQuery({ projectId }, { enabled: Boolean(workspace.data) && (state === "review" || state === "export-ready") });
  const draftPreview = trpc.drafting.latest.useQuery({ projectId }, { enabled: Boolean(workspace.data) && state === "draft" });
  const styleLibrary = trpc.style.library.useQuery(undefined, { enabled: isAuthenticated && ["draft", "diagnosed"].includes(state) });

  useEffect(() => {
    if (!workspace.data) return;
    const projectState = workspace.data.project.currentState as ProjectState;
    const requestedView = new URLSearchParams(window.location.search).get("view") as WorkspaceView | null;
    const allowedViews: WorkspaceView[] = ["overview", "draft", "manuscript", "diagnosis", "revision", "versions", "export"];
    setView(requestedView && allowedViews.includes(requestedView) && viewAvailability(projectState)[requestedView] ? requestedView : stateDefaultView(projectState));
  }, [workspace.data?.project.currentState]);
  useEffect(() => { if (workspace.data?.activeVersion) setManuscript(workspace.data.activeVersion.content); }, [workspace.data?.activeVersion?.id]);
  useEffect(() => { if (workspace.data?.activeVersion?.content.trim()) setDraftMode("append-chapter"); }, [workspace.data?.activeVersion?.id]);
  useEffect(() => {
    if (diagnosis.data?.findings) setSelectedFindings(diagnosis.data.findings.filter(finding => finding.selectedByDefault).map(finding => finding.id));
  }, [diagnosis.data?.diagnosis.id]);
  useEffect(() => {
    const versions = workspace.data?.versions || [];
    if (!versions.length) return;
    const activeId = workspace.data?.project.activeVersionId || versions[0].id;
    if (!rightVersionId) setRightVersionId(activeId);
    if (!leftVersionId) setLeftVersionId(versions.find(version => version.id !== activeId)?.id || versions[0].id);
  }, [workspace.data?.versions.length, workspace.data?.project.activeVersionId]);

  const refresh = async () => {
    await Promise.all([
      utils.projects.get.invalidate({ projectId }),
      utils.projects.list.invalidate(),
      utils.workshop.latest.invalidate({ projectId }),
      utils.revisions.latestPlan.invalidate({ projectId }),
      jobId ? utils.revisions.status.invalidate({ jobId }) : Promise.resolve(),
      utils.exports.latestPreflight.invalidate({ projectId }),
      utils.drafting.latest.invalidate({ projectId }),
    ]);
  };

  const save = trpc.projects.saveManuscript.useMutation({
    onSuccess: async () => { toast.success("Named manuscript snapshot saved."); await refresh(); },
    onError: error => toast.error(parseCaspaError(error, "The manuscript could not be saved.").message),
  });
  const upload = trpc.projects.uploadManuscript.useMutation({
    onSuccess: async () => { toast.success("Manuscript uploaded and versioned."); await refresh(); },
    onError: error => toast.error(parseCaspaError(error, "Upload a UTF-8 text or Markdown file up to 8 MB.").message),
  });
  const generateDraft = trpc.drafting.preview.useMutation({
    onSuccess: async () => { toast.success("CASPA prepared a private draft preview. Nothing has been added to the manuscript."); setDraftAccepted(false); await refresh(); },
    onError: error => toast.error(parseCaspaError(error, "CASPA could not prepare a safe draft preview. Your manuscript is unchanged.").message),
  });
  const acceptDraft = trpc.drafting.accept.useMutation({
    onSuccess: async () => { toast.success("Draft accepted as a named manuscript version."); setDraftAccepted(false); await refresh(); setView("manuscript"); },
    onError: error => toast.error(parseCaspaError(error, "The draft preview could not be accepted. Your manuscript is unchanged.").message),
  });
  const rejectDraft = trpc.drafting.reject.useMutation({
    onSuccess: async () => { toast.success("Draft preview rejected. The manuscript is unchanged."); await refresh(); },
    onError: error => toast.error(parseCaspaError(error, "The draft preview could not be rejected.").message),
  });
  const diagnose = trpc.workshop.diagnose.useMutation({
    onSuccess: async result => {
      toast.success(result.mode === "ai" ? "Editorial diagnosis complete." : "Safety diagnosis complete. The editorial service was temporarily unavailable.");
      await refresh();
      setView("diagnosis");
    },
    onError: error => toast.error(parseCaspaError(error, "Diagnosis paused safely. Your manuscript is unchanged.").message),
  });
  const approve = trpc.revisions.approvePlan.useMutation({
    onSuccess: async () => { toast.success("Revision plan approved. No text has changed yet."); await refresh(); setView("revision"); },
    onError: error => toast.error(parseCaspaError(error, "The plan was not approved.").message),
  });
  const start = trpc.revisions.start.useMutation({
    onSuccess: async () => { toast.success("Revision job created. The source snapshot is protected."); await refresh(); },
    onError: error => toast.error(parseCaspaError(error, "The revision job was not started.").message),
  });
  const advance = trpc.revisions.advance.useMutation({ onSuccess: refresh, onError: () => toast.error("Revision paused at its last checkpoint. You can resume it safely.") });
  const retry = trpc.revisions.retry.useMutation({ onSuccess: refresh, onError: () => toast.error("The failed checkpoint could not be resumed yet.") });
  const accept = trpc.revisions.accept.useMutation({
    onSuccess: async () => { toast.success("Revision accepted. Export preflight is now available."); await refresh(); },
    onError: () => toast.error("The revision result still needs review."),
  });
  const restoreVersionMutation = trpc.versions.restore.useMutation({
    onSuccess: async () => { toast.success("A new snapshot was created from the selected version."); setRestoreConfirmed(false); await refresh(); setView("overview"); },
    onError: error => toast.error(parseCaspaError(error, "The version was not restored. Your current manuscript is unchanged.").message),
  });
  const preflight = trpc.exports.preflight.useMutation({
    onSuccess: async result => { result.passed ? toast.success("All export checks passed.") : toast.error("Preflight found items that still need attention."); await refresh(); },
    onError: error => toast.error(parseCaspaError(error, "Export preflight could not be completed.").message),
  });
  const download = trpc.exports.download.useMutation({
    onSuccess: file => downloadTextFile(file.filename, file.mimeType, file.content),
    onError: error => toast.error(parseCaspaError(error, "Download remains locked until the latest server preflight passes.").message),
  });
  const archiveProject = trpc.projects.archive.useMutation({
    onSuccess: async () => { toast.success("Project archived."); await refresh(); setView("overview"); },
    onError: () => toast.error("The project could not be archived."),
  });
  const restoreArchivedProject = trpc.projects.restoreArchive.useMutation({
    onSuccess: async () => { toast.success("Project restored to draft state."); await refresh(); },
    onError: () => toast.error("The project could not be restored."),
  });

  const currentJob = jobStatus.data?.job || plan.data?.job;
  useEffect(() => {
    if (state !== "revision-running" || !currentJob || advance.isPending) return;
    if (!['queued', 'running'].includes(currentJob.status)) return;
    const timer = window.setTimeout(() => advance.mutate({ jobId: currentJob.id }), 900);
    return () => window.clearTimeout(timer);
  }, [state, currentJob?.status, currentJob?.currentChapter, advance.isPending]);

  const availability = viewAvailability(state);
  const navItems: { id: WorkspaceView; label: string; icon: typeof BookOpenText }[] = [
    { id: "overview", label: "Overview", icon: Gauge },
    { id: "draft", label: "Draft with CASPA", icon: Sparkles },
    { id: "manuscript", label: "Manuscript", icon: BookOpenText },
    { id: "diagnosis", label: "Diagnosis", icon: ScanSearch },
    { id: "revision", label: "Revision", icon: Sparkles },
    { id: "versions", label: "Versions", icon: History },
    { id: "export", label: "Export", icon: BookCheck },
  ];

  if (authLoading || workspace.isLoading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  if (!isAuthenticated) { setLocation("/"); return null; }
  if (!workspace.data) return <CaspaShell><div className="container py-16"><WorkspaceCard eyebrow="Project" title="This manuscript is unavailable"><Button variant="outline" onClick={() => setLocation("/")}><ArrowLeft className="size-4" /> Return to projects</Button></WorkspaceCard></div></CaspaShell>;

  const { project, activeVersion, versions } = workspace.data;
  const next = nextGuidedAction(state);
  const nextCopy = ACTION_COPY[next];
  const productionAvailable = ["export-ready", "art-direction", "art-approved", "layout", "proof-review", "production-ready"].includes(state);
  const canEdit = canPerformAction(state, "edit-manuscript");
  const visibleFindings = (diagnosis.data?.findings || []).filter(finding => {
    const severityMatches = severityFilter === "all" || finding.severity === severityFilter;
    const selected = selectedFindings.includes(finding.id);
    const selectionMatches = selectionFilter === "all" || (selectionFilter === "selected" ? selected : !selected);
    return severityMatches && selectionMatches;
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".txt") && !lower.endsWith(".md")) { toast.error("Upload a .txt or .md manuscript."); return; }
    const dataBase64 = await fileAsBase64(file);
    upload.mutate({ projectId, fileName: file.name, mimeType: lower.endsWith(".md") ? "text/markdown" : "text/plain", dataBase64 });
  };

  const handlePasteSnapshot = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!canEdit || save.isPending) return;
    const pasted = event.clipboardData.getData("text");
    if (!pasted.trim()) return;
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const nextContent = manuscript.slice(0, start) + pasted + manuscript.slice(end);
    window.setTimeout(() => save.mutate({ projectId, content: nextContent, name: `Pasted manuscript · ${new Date().toLocaleString()}` }), 0);
  };

  return (
    <CaspaShell>
      <div className="container py-8 sm:py-10">
        <button type="button" className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-primary" onClick={() => setLocation("/")}><ArrowLeft className="size-3.5" /> All projects</button>
        <section className="literary-card overflow-hidden">
          <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div><div className="flex flex-wrap items-center gap-3"><span className="eyebrow">{project.format.replace("-", " ")}</span><span className="rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-primary">{STATE_LABELS[state]}</span></div><h1 className="mt-3 text-5xl font-semibold tracking-tight sm:text-6xl">{project.title}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">{project.premise}</p></div>
            <div className="min-w-56 rounded-xl border border-border bg-black/15 p-4"><p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-muted-foreground">Current manuscript</p><div className="mt-2 flex items-baseline justify-between gap-4"><span className="font-display text-3xl font-semibold">{project.wordCount.toLocaleString()}</span><span className="text-xs text-muted-foreground">of {project.targetWordCount.toLocaleString()} words</span></div><Progress value={wordProgress(project.wordCount, project.targetWordCount)} className="mt-3 h-1.5" /></div>
          </div>
          <div className="border-t border-border px-6 py-5 sm:px-8"><WorkflowRail state={state} /></div>
        </section>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {navItems.map(item => {
            const enabled = availability[item.id];
            const Icon = item.icon;
            return <button key={item.id} type="button" disabled={!enabled} onClick={() => enabled && setView(item.id)} className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold ${view === item.id ? "border-primary/55 bg-primary/12 text-primary" : enabled ? "border-border bg-card/55 text-muted-foreground hover:border-primary/30 hover:text-foreground" : "border-transparent bg-black/10 text-muted-foreground/35"}`}>{enabled ? <Icon className="size-3.5" /> : <LockKeyhole className="size-3.5" />}{item.label}</button>;
          })}
          {productionAvailable && <button type="button" onClick={() => setLocation(`/projects/${projectId}/production`)} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-primary/45 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary"><Sparkles className="size-3.5" /> Book production</button>}
          <button type="button" onClick={() => setLocation(`/projects/${projectId}/collaboration`)} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card/55 px-4 py-2 text-xs font-semibold text-muted-foreground hover:border-primary/30 hover:text-foreground"><Users className="size-3.5" /> Collaborators</button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {view === "draft" && (styleLibrary.data?.profiles || []).filter(profile => profile.status === "active").length > 0 && <section className="mb-5 rounded-xl border border-primary/25 bg-primary/[0.045] p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Private craft profile</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Optionally ground this preview in an author-owned profile. CASPA receives only a craft summary, never the sample passages.</p></div><div className="min-w-56"><select value={draftStyleProfileId} onChange={event => setDraftStyleProfileId(Number(event.target.value))} className="h-10 w-full rounded-md border border-border bg-black/15 px-3 text-sm"><option value={0}>No profile selected</option>{(styleLibrary.data?.profiles || []).filter(profile => profile.status === "active").map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></div></div>{draftStyleProfileId > 0 && <div className="mt-4 flex justify-end"><Button size="sm" disabled={generateDraft.isPending || draftTitle.trim().length < 2 || draftTargetWords < 250 || draftTargetWords > 6000} onClick={() => generateDraft.mutate({ projectId, mode: draftMode, chapterTitle: draftTitle, chapterNumber: draftMode === "replace-chapter" ? draftChapterNumber : null, targetWords: draftTargetWords, outline: draftOutline || undefined, voiceNotes: draftVoiceNotes || undefined, exclusions: draftExclusions || undefined, styleProfileId: draftStyleProfileId })}>{generateDraft.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Prepare profile-grounded preview</Button></div>}</section>}
            {view === "overview" && <WorkspaceCard eyebrow="Guided next step" title={nextCopy.label}><div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center"><p className="max-w-2xl text-sm leading-7 text-muted-foreground">{nextCopy.detail}</p><Button className="gap-2" onClick={() => productionAvailable ? setLocation(`/projects/${projectId}/production`) : setView(stateDefaultView(state))}>Open next step <ArrowRight className="size-4" /></Button></div><div className="mt-7 border-t border-border pt-5"><div className="flex items-center justify-between gap-3"><p className="eyebrow">Recent versions</p><button type="button" onClick={() => setView("versions")} className="text-xs font-semibold text-primary">View history</button></div><div className="mt-3 grid gap-2 sm:grid-cols-3">{versions.slice(0, 3).map(version => <div key={version.id} className="rounded-lg border border-border bg-black/15 p-3"><p className="truncate text-sm font-semibold">{version.name}</p><p className="mt-1 text-[0.66rem] text-muted-foreground">{version.wordCount.toLocaleString()} words · {new Date(version.createdAt).toLocaleDateString()}</p></div>)}</div></div></WorkspaceCard>}

            {view === "draft" && <WorkspaceCard eyebrow="Draft with CASPA" title="Begin with an author-controlled chapter"><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]"><div className="space-y-5"><div className="rounded-xl border border-primary/25 bg-primary/[0.055] p-5"><p className="font-display text-2xl font-semibold">CASPA drafts. You decide.</p><p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">Your premise, outline, selected chapter scope, and existing manuscript ground the preview. It remains separate from the manuscript until you accept it as a version.</p></div><RadioGroup value={draftMode} onValueChange={value => setDraftMode(value as DraftMode)} className="grid gap-3 sm:grid-cols-3">{([{ id: "opening", label: "Opening" }, { id: "append-chapter", label: "Next chapter" }, { id: "replace-chapter", label: "Replace chapter" }] as const).map(option => <Label key={option.id} htmlFor={`draft-${option.id}`} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm ${draftMode === option.id ? "border-primary/45 bg-primary/8" : "border-border bg-black/10"} ${option.id === "opening" && activeVersion?.content.trim() ? "cursor-not-allowed opacity-45" : ""}`}><RadioGroupItem id={`draft-${option.id}`} value={option.id} disabled={option.id === "opening" && Boolean(activeVersion?.content.trim())} />{option.label}</Label>)}</RadioGroup><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="draft-title">Chapter title</Label><Input id="draft-title" value={draftTitle} onChange={event => setDraftTitle(event.target.value)} className="bg-black/15" /></div><div className="space-y-2"><Label htmlFor="draft-target">Target words</Label><Input id="draft-target" type="number" min={250} max={6000} value={draftTargetWords} onChange={event => setDraftTargetWords(Number(event.target.value))} className="bg-black/15" /></div></div>{draftMode === "replace-chapter" && <div className="max-w-48 space-y-2"><Label htmlFor="draft-chapter">Chapter to replace</Label><Input id="draft-chapter" type="number" min={1} max={Math.max(1, project.chapterCount)} value={draftChapterNumber} onChange={event => setDraftChapterNumber(Number(event.target.value))} className="bg-black/15" /></div>}<div className="grid gap-4"><div className="space-y-2"><Label htmlFor="draft-outline">Outline or beat notes <span className="text-muted-foreground">(optional)</span></Label><textarea id="draft-outline" rows={5} value={draftOutline} onChange={event => setDraftOutline(event.target.value)} className="w-full rounded-lg border border-border bg-black/15 px-3 py-2 text-sm leading-6 outline-none focus:border-primary" placeholder="What must happen in this chapter? What should remain unresolved?" /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="draft-voice">Voice notes <span className="text-muted-foreground">(optional)</span></Label><textarea id="draft-voice" rows={4} value={draftVoiceNotes} onChange={event => setDraftVoiceNotes(event.target.value)} className="w-full rounded-lg border border-border bg-black/15 px-3 py-2 text-sm leading-6 outline-none focus:border-primary" placeholder="Sentence rhythm, distance, tone…" /></div><div className="space-y-2"><Label htmlFor="draft-exclusions">Exclude <span className="text-muted-foreground">(optional)</span></Label><textarea id="draft-exclusions" rows={4} value={draftExclusions} onChange={event => setDraftExclusions(event.target.value)} className="w-full rounded-lg border border-border bg-black/15 px-3 py-2 text-sm leading-6 outline-none focus:border-primary" placeholder="No romance, do not resolve the mystery…" /></div></div></div><Button size="lg" disabled={generateDraft.isPending || draftTitle.trim().length < 2 || draftTargetWords < 250 || draftTargetWords > 6000} onClick={() => generateDraft.mutate({ projectId, mode: draftMode, chapterTitle: draftTitle, chapterNumber: draftMode === "replace-chapter" ? draftChapterNumber : null, targetWords: draftTargetWords, outline: draftOutline || undefined, voiceNotes: draftVoiceNotes || undefined, exclusions: draftExclusions || undefined })}>{generateDraft.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {draftPreview.data?.status === "previewed" ? "Regenerate preview" : "Prepare draft preview"}</Button></div><aside className="rounded-xl border border-border bg-black/15 p-5">{draftPreview.isLoading ? <div className="grid min-h-64 place-items-center"><Loader2 className="size-5 animate-spin text-primary" /></div> : draftPreview.data?.status === "previewed" ? <><p className="eyebrow">Private preview</p><h3 className="mt-2 text-2xl font-semibold">{draftPreview.data.chapterTitle}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{draftPreview.data.groundingSummary}</p><div className="mt-4 max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-card/65 p-4 font-serif text-sm leading-7 text-foreground/90">{draftPreview.data.content}</div><p className="mt-3 text-xs text-muted-foreground">{draftPreview.data.targetWords.toLocaleString()} word target · preview has not changed the manuscript</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(draftPreview.data!.content).then(() => toast.success("Preview copied."))}>Copy preview</Button><Button size="sm" variant="ghost" disabled={rejectDraft.isPending} onClick={() => rejectDraft.mutate({ previewId: draftPreview.data!.id })}>Reject</Button></div><Label className="mt-5 flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/[0.05] p-3 text-xs leading-5 text-muted-foreground"><Checkbox checked={draftAccepted} onCheckedChange={value => setDraftAccepted(Boolean(value))} /><span>I approve this exact preview. CASPA will save it as a new named manuscript version; it will not overwrite history.</span></Label><Button className="mt-3 w-full" disabled={!draftAccepted || acceptDraft.isPending} onClick={() => acceptDraft.mutate({ previewId: draftPreview.data!.id, authorConfirmed: true })}>{acceptDraft.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Accept as new version</Button></> : <div className="grid min-h-64 place-items-center text-center"><div><Sparkles className="mx-auto size-6 text-primary" /><p className="mt-3 font-display text-xl font-semibold">Your draft preview will appear here</p><p className="mt-2 text-xs leading-5 text-muted-foreground">CASPA will not write into the manuscript until you explicitly accept the preview.</p></div></div>}</aside></div></WorkspaceCard>}

            {view === "manuscript" && <WorkspaceCard eyebrow="Workshop · manuscript" title={canEdit ? "Paste or upload the work" : "Diagnosis snapshot"} aside={<span className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">Version {activeVersion?.id || "—"}</span>}>
              <textarea className="manuscript-field" value={manuscript} readOnly={!canEdit} onChange={event => setManuscript(event.target.value)} onPaste={handlePasteSnapshot} placeholder="Paste the current manuscript or structured plan here. Chapter headings help CASPA create precise checkpoints." aria-label="Manuscript text" />
              {canEdit ? <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-2">
                  <input ref={fileInput} type="file" className="hidden" accept=".txt,.md,text/plain,text/markdown" onChange={event => void handleFile(event.target.files?.[0])} />
                  <Button variant="outline" disabled={!canEdit || upload.isPending} onClick={() => fileInput.current?.click()}>{upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} Upload .txt or .md</Button>
                  <Button variant="outline" disabled={!canEdit || save.isPending || !manuscript.trim()} onClick={() => save.mutate({ projectId, content: manuscript, name: `Manual save · ${new Date().toLocaleString()}` })}>{save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save snapshot</Button>
                </div>
                {state === "draft" && <Button disabled={diagnose.isPending || !manuscript.trim() || manuscript !== (activeVersion?.content || "")} onClick={() => diagnose.mutate({ projectId })}>{diagnose.isPending ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />} Diagnose saved version</Button>}
              </div> : <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-black/15 p-4 text-xs leading-6 text-muted-foreground"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" /><span>This is a historical snapshot. Manuscript editing is available only while the project is in Draft.</span></div>}
              {state === "draft" && manuscript !== (activeVersion?.content || "") && <p className="mt-3 text-xs text-primary">Save a named snapshot before diagnosis. CASPA never diagnoses unsaved browser text.</p>}
            </WorkspaceCard>}

            {view === "diagnosis" && <WorkspaceCard eyebrow="Workshop · diagnosis" title="Evidence before opinion" aside={diagnosis.data?.diagnosis.mode === "deterministic-fallback" ? <span className="rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs text-primary">Safety review</span> : undefined}>
              {diagnosis.isLoading ? <div className="grid min-h-48 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div> : diagnosis.data ? <>
                <div className="rounded-xl border border-border bg-black/15 p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-display text-2xl font-semibold">Editorial summary</p><p className="mt-2 text-sm leading-7 text-muted-foreground">{diagnosis.data.diagnosis.overallSummary}</p><p className="mt-3 text-xs text-muted-foreground">Rubric {diagnosis.data.diagnosis.rubricVersion} · confidence {diagnosis.data.diagnosis.overallConfidence}%</p></div></div></div>
                <div className="mt-5 flex flex-wrap gap-3 rounded-xl border border-border bg-black/15 p-4">
                  <div className="space-y-1.5"><Label htmlFor="severityFilter" className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Severity</Label><select id="severityFilter" value={severityFilter} onChange={event => setSeverityFilter(event.target.value as typeof severityFilter)} className="h-9 rounded-md border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-primary"><option value="all">All severities</option><option value="critical">Critical</option><option value="major">Major</option><option value="moderate">Moderate</option><option value="minor">Minor</option></select></div>
                  <div className="space-y-1.5"><Label htmlFor="selectionFilter" className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Plan selection</Label><select id="selectionFilter" value={selectionFilter} onChange={event => setSelectionFilter(event.target.value as typeof selectionFilter)} className="h-9 rounded-md border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-primary"><option value="all">All findings</option><option value="selected">Selected fixes</option><option value="unselected">Unselected fixes</option></select></div>
                  <div className="ml-auto self-end text-xs text-muted-foreground">Showing {visibleFindings.length} of {diagnosis.data.findings.length} findings</div>
                </div>
                <div className="mt-3 space-y-3">
                  {visibleFindings.map(finding => {
                    const checked = selectedFindings.includes(finding.id);
                    return <article key={finding.id} className={`rounded-xl border p-5 transition ${checked ? "border-primary/35 bg-primary/[0.055]" : "border-border bg-black/10 opacity-65"}`}>
                      <div className="flex items-start gap-4"><Checkbox checked={checked} disabled={state !== "diagnosed"} onCheckedChange={value => setSelectedFindings(current => value ? Array.from(new Set(current.concat(finding.id))) : current.filter(id => id !== finding.id))} aria-label={`Select ${finding.title}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-border px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">{finding.criterion}</span><span className={`rounded-full px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wider ${finding.severity === "critical" ? "bg-destructive/15 text-red-300" : finding.severity === "major" ? "bg-amber-500/12 text-amber-300" : "bg-secondary text-muted-foreground"}`}>{finding.severity}</span><span className="text-[0.65rem] text-muted-foreground">{finding.confidence}% confidence</span></div><h3 className="mt-3 text-2xl font-semibold">{finding.title}</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">{finding.rationale}</p><blockquote className="mt-4 border-l-2 border-primary/45 bg-black/15 px-4 py-3 font-serif text-sm leading-6 text-foreground/85">“{finding.evidenceQuote}”<footer className="mt-2 font-sans text-[0.65rem] uppercase tracking-wider text-primary">{finding.citationLabel}</footer></blockquote><div className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-sm leading-6"><strong className="text-primary">Proposed fix:</strong> <span className="text-muted-foreground">{finding.suggestedFix}</span></div></div></div>
                    </article>;
                  })}
                  {!visibleFindings.length && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No findings match these filters.</div>}
                </div>
                {state === "diagnosed" ? <div className="mt-6 rounded-xl border border-border bg-black/15 p-5">
                  <p className="eyebrow">Revision scope</p>
                  <RadioGroup value={scope} onValueChange={value => setScope(value as typeof scope)} className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[{ id: "whole-book", label: "Whole book" }, { id: "chapter-range", label: "Chapter range" }, { id: "single-chapter", label: "Single chapter" }].map(option => <Label key={option.id} htmlFor={option.id} className={`flex items-center gap-3 rounded-lg border p-3 ${scope === option.id ? "border-primary/40 bg-primary/8" : "border-border"}`}><RadioGroupItem id={option.id} value={option.id} />{option.label}</Label>)}
                  </RadioGroup>
                  {scope !== "whole-book" && <div className="mt-4 flex gap-3"><div className="space-y-2"><Label htmlFor="startChapter">{scope === "single-chapter" ? "Chapter" : "From chapter"}</Label><Input id="startChapter" type="number" min={1} value={startChapter} onChange={event => setStartChapter(Number(event.target.value))} className="w-36 bg-black/15" /></div>{scope === "chapter-range" && <div className="space-y-2"><Label htmlFor="endChapter">To chapter</Label><Input id="endChapter" type="number" min={startChapter} value={endChapter} onChange={event => setEndChapter(Number(event.target.value))} className="w-36 bg-black/15" /></div>}</div>}
                  {(styleLibrary.data?.profiles || []).filter(profile => profile.status === "active").length > 0 && <div className="mt-5 rounded-lg border border-primary/20 bg-primary/[0.04] p-4"><Label htmlFor="revision-style-profile" className="text-sm font-semibold">Private craft profile <span className="font-normal text-muted-foreground">(optional)</span></Label><p className="mt-1 text-xs leading-5 text-muted-foreground">Use transferable craft dimensions only. CASPA never supplies your source excerpts to the revision model.</p><select id="revision-style-profile" value={revisionStyleProfileId} onChange={event => setRevisionStyleProfileId(Number(event.target.value))} className="mt-3 h-10 w-full rounded-md border border-border bg-black/15 px-3 text-sm"><option value={0}>No profile selected</option>{(styleLibrary.data?.profiles || []).filter(profile => profile.status === "active").map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></div>}
                  <Label className="mt-5 flex items-start gap-3 text-sm leading-6 text-muted-foreground"><Checkbox checked={planConfirmed} onCheckedChange={value => setPlanConfirmed(Boolean(value))} className="mt-1" /><span>I approve the selected fixes and this scope. I understand the source version remains unchanged and the revision will create a new version.</span></Label>
                  <div className="mt-5 flex justify-end"><Button disabled={!selectedFindings.length || !planConfirmed || approve.isPending} onClick={() => approve.mutate({ projectId, diagnosisId: diagnosis.data!.diagnosis.id, findingIds: selectedFindings, scope, startChapter: scope === "whole-book" ? null : startChapter, endChapter: scope === "chapter-range" ? endChapter : scope === "single-chapter" ? startChapter : null, styleProfileId: revisionStyleProfileId || null, authorConfirmed: true })}>{approve.isPending ? <Loader2 className="size-4 animate-spin" /> : <ScrollText className="size-4" />} Approve revision plan</Button></div>
                </div> : <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-black/15 p-4 text-xs leading-6 text-muted-foreground"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" /><span>This diagnosis remains available as project history. A revision plan can be approved only while the project is in Diagnosed.</span></div>}
              </> : <p className="text-sm text-muted-foreground">No diagnosis exists for this project.</p>}
            </WorkspaceCard>}

            {view === "revision" && <WorkspaceCard eyebrow="Workshop · revision" title={state === "plan-approved" ? "Approved plan" : state === "revision-running" ? "Revision in progress" : "Review the result"}>
              {plan.data ? <>
                <div className="grid gap-3 sm:grid-cols-2">{plan.data.items.map(({ finding }) => <div key={finding.id} className="rounded-lg border border-border bg-black/15 p-4"><span className="text-[0.62rem] font-bold uppercase tracking-wider text-primary">{finding.severity} · {finding.criterion}</span><p className="mt-2 font-display text-xl font-semibold">{finding.title}</p></div>)}</div>
                <div className="mt-5 rounded-xl border border-border bg-secondary/35 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold">Scope: {plan.data.plan.scope.replace("-", " ")}</p><p className="mt-1 text-xs text-muted-foreground">The source version remains protected. Every completed chapter becomes a durable checkpoint.</p></div>{state === "plan-approved" && <div className="flex flex-col items-end gap-3"><Label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={revisionConfirmed} onCheckedChange={value => setRevisionConfirmed(Boolean(value))} /> Start this approved plan</Label><Button disabled={!revisionConfirmed || start.isPending} onClick={() => start.mutate({ planId: plan.data!.plan.id, authorConfirmed: true })}>{start.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Start revision job</Button></div>}</div></div>
                {currentJob && <div className="mt-5 rounded-xl border border-border bg-black/15 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">Job #{currentJob.id}</p><h3 className="mt-2 text-2xl font-semibold capitalize">{currentJob.status.replaceAll("-", " ")}</h3></div><span className="font-display text-4xl font-semibold text-primary">{currentJob.progress}%</span></div><Progress value={currentJob.progress} className="mt-4 h-2" /><div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3"><span>{currentJob.currentChapter} / {currentJob.totalChapters} checkpoints</span><span>{currentJob.beforeWordCount.toLocaleString()} → {currentJob.afterWordCount.toLocaleString()} words</span><span>{currentJob.warningCount} warnings</span></div>
                  {jobStatus.data?.checkpoints?.length ? <div className="mt-5 space-y-2">{jobStatus.data.checkpoints.map(checkpoint => <div key={checkpoint.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3"><span className={`grid size-7 place-items-center rounded-full ${checkpoint.status === "succeeded" ? "bg-emerald-500/15 text-emerald-300" : checkpoint.status === "warning" ? "bg-amber-500/15 text-amber-300" : checkpoint.status === "running" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>{checkpoint.status === "succeeded" ? <Check className="size-3.5" /> : checkpoint.status === "warning" ? <AlertTriangle className="size-3.5" /> : checkpoint.status === "running" ? <Loader2 className="size-3.5 animate-spin" /> : <CircleDashed className="size-3.5" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{checkpoint.chapterTitle}</p><p className="text-[0.66rem] text-muted-foreground">{checkpoint.beforeWordCount} → {checkpoint.afterWordCount || "—"} words · {checkpoint.progress}%</p></div></div>)}</div> : null}
                  {currentJob.status === "failed" && <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-destructive/35 bg-destructive/8 p-4"><p className="text-sm text-red-200">The job stopped safely. Completed checkpoints were retained.</p><Button variant="outline" disabled={retry.isPending} onClick={() => retry.mutate({ jobId: currentJob.id })}><RotateCcw className="size-4" /> Resume</Button></div>}
                  {currentJob.status === "awaiting-review" && <div className="mt-5 flex flex-col justify-between gap-4 rounded-lg border border-primary/30 bg-primary/8 p-4 sm:flex-row sm:items-center"><div><p className="font-display text-xl font-semibold">The revision is ready for your review</p><p className="mt-1 text-xs text-muted-foreground">Accepting it confirms this new version as the basis for export preflight.</p></div><Button disabled={accept.isPending} onClick={() => accept.mutate({ jobId: currentJob.id, authorConfirmed: true })}>{accept.isPending ? <Loader2 className="size-4 animate-spin" /> : <BookCheck className="size-4" />} Accept revision</Button></div>}
                </div>}
              </> : <div className="grid min-h-40 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            </WorkspaceCard>}

            {view === "versions" && <WorkspaceCard eyebrow="Project memory" title="Version history">
              <div className="grid gap-4 rounded-xl border border-border bg-black/15 p-5 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
                <div className="space-y-2"><Label htmlFor="leftVersion">Earlier version</Label><select id="leftVersion" value={leftVersionId} onChange={event => setLeftVersionId(Number(event.target.value))} className="h-10 w-full rounded-md border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-primary">{versions.map(version => <option key={version.id} value={version.id}>{version.name}</option>)}</select></div>
                <GitCompareArrows className="mx-auto mb-2 size-4 text-primary" />
                <div className="space-y-2"><Label htmlFor="rightVersion">Later version</Label><select id="rightVersion" value={rightVersionId} onChange={event => setRightVersionId(Number(event.target.value))} className="h-10 w-full rounded-md border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-primary">{versions.map(version => <option key={version.id} value={version.id}>{version.name}</option>)}</select></div>
              </div>
              {comparison.data && <div className="mt-4"><div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="rounded-full border border-border px-3 py-1">Word delta: <strong className="text-foreground">{comparison.data.wordDelta > 0 ? "+" : ""}{comparison.data.wordDelta.toLocaleString()}</strong></span><span className="rounded-full border border-border px-3 py-1">Section delta: <strong className="text-foreground">{comparison.data.chapterDelta > 0 ? "+" : ""}{comparison.data.chapterDelta}</strong></span></div><div className="grid gap-3 lg:grid-cols-2"><div className="rounded-xl border border-border bg-black/15 p-4"><p className="eyebrow">{comparison.data.left.name}</p><div className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap font-serif text-sm leading-7 text-muted-foreground">{comparison.data.left.content || "Empty manuscript"}</div></div><div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4"><p className="eyebrow">{comparison.data.right.name}</p><div className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap font-serif text-sm leading-7 text-muted-foreground">{comparison.data.right.content || "Empty manuscript"}</div></div></div><div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-border bg-secondary/35 p-4 sm:flex-row sm:items-center"><Label className="flex items-start gap-3 text-xs leading-5 text-muted-foreground"><Checkbox checked={restoreConfirmed} onCheckedChange={value => setRestoreConfirmed(Boolean(value))} /><span>Create a new snapshot from <strong className="text-foreground">{comparison.data.left.name}</strong>. Current history will not be overwritten.</span></Label><Button variant="outline" disabled={!restoreConfirmed || restoreVersionMutation.isPending} onClick={() => restoreVersionMutation.mutate({ projectId, versionId: comparison.data!.left.id, authorConfirmed: true })}>{restoreVersionMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />} Restore as new snapshot</Button></div></div>}
              <div className="mt-6 space-y-2">{versions.map(version => <div key={version.id} className={`flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${version.id === project.activeVersionId ? "border-primary/35 bg-primary/[0.055]" : "border-border bg-black/10"}`}><div><div className="flex items-center gap-2"><FileClock className="size-4 text-primary" /><p className="font-semibold">{version.name}</p>{version.id === project.activeVersionId && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wider text-primary">Active</span>}</div><p className="mt-1 text-xs text-muted-foreground">{version.wordCount.toLocaleString()} words · {version.chapterCount} sections · {new Date(version.createdAt).toLocaleString()}</p></div><ChevronRight className="hidden size-4 text-muted-foreground sm:block" /></div>)}</div>
            </WorkspaceCard>}

            {view === "export" && <WorkspaceCard eyebrow="Publication gate" title={state === "export-ready" ? "Cleared for export" : "Preflight required"} aside={state === "review" ? <Button disabled={preflight.isPending} onClick={() => preflight.mutate({ projectId })}>{preflight.isPending ? <Loader2 className="size-4 animate-spin" /> : <BookCheck className="size-4" />} Run server preflight</Button> : undefined}>
              <p className="text-sm leading-7 text-muted-foreground">CASPA checks the active server version against the rules for {project.format.replace("-", " ")}. The browser cannot override a failed check.</p>
              <div className="mt-5 space-y-3">{latestPreflight.data?.checks?.map((check: { id: string; label: string; passed: boolean; detail: string }) => <div key={check.id} className={`flex items-start gap-4 rounded-xl border p-4 ${check.passed ? "border-emerald-500/25 bg-emerald-500/[0.055]" : "border-amber-500/25 bg-amber-500/[0.055]"}`}><span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${check.passed ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{check.passed ? <Check className="size-4" /> : <AlertTriangle className="size-4" />}</span><div><p className="font-semibold">{check.label}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">{check.detail}</p></div></div>)}</div>
              {!latestPreflight.data && <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center"><BookCheck className="mx-auto size-6 text-primary" /><p className="mt-3 font-display text-2xl font-semibold">No preflight has run for this version</p><p className="mt-2 text-xs text-muted-foreground">Accept the latest revision, then ask the server to verify all four publication checks.</p></div>}
              {state === "export-ready" && <div className="mt-6 flex flex-col justify-between gap-4 rounded-xl border border-primary/30 bg-primary/8 p-5 sm:flex-row sm:items-center"><div><p className="font-display text-2xl font-semibold">The active version is export-ready</p><p className="mt-1 text-xs text-muted-foreground">Choose a portable text format. Both routes re-check authorization and the latest passing preflight.</p></div><div className="flex gap-2"><Button variant="outline" disabled={download.isPending} onClick={() => download.mutate({ projectId, format: "txt" })}><Download className="size-4" /> .txt</Button><Button disabled={download.isPending} onClick={() => download.mutate({ projectId, format: "md" })}><Download className="size-4" /> Markdown</Button></div></div>}
            </WorkspaceCard>}
          </div>

          <aside className="space-y-5">
            <section className="literary-card p-5"><p className="eyebrow">Next action</p><h3 className="mt-2 text-2xl font-semibold">{nextCopy.label}</h3><p className="mt-3 text-xs leading-6 text-muted-foreground">{nextCopy.detail}</p><div className="mt-5 gold-rule" /><div className="mt-5 space-y-3 text-xs text-muted-foreground"><div className="flex items-center justify-between"><span>State</span><strong className="text-foreground">{STATE_LABELS[state]}</strong></div><div className="flex items-center justify-between"><span>Versions</span><strong className="text-foreground">{versions.length}</strong></div><div className="flex items-center justify-between"><span>Sections</span><strong className="text-foreground">{project.chapterCount}</strong></div></div></section>
            <section className="rounded-2xl border border-primary/20 bg-primary/[0.055] p-5"><ShieldCheck className="size-5 text-primary" /><h3 className="mt-3 font-display text-xl font-semibold">Controlled changes</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">CASPA never overwrites a source version. Diagnosis, approval, revision, and restore each create an auditable record.</p></section>
            <section className="rounded-2xl border border-border bg-card/55 p-5"><p className="eyebrow">Project status</p>{state === "archived" ? <Button variant="outline" className="mt-4 w-full" disabled={restoreArchivedProject.isPending} onClick={() => restoreArchivedProject.mutate({ projectId })}>{restoreArchivedProject.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Restore to writing desk</Button> : <Button variant="ghost" className="mt-4 w-full justify-start text-muted-foreground hover:text-foreground" disabled={archiveProject.isPending || state === "revision-running"} onClick={() => archiveProject.mutate({ projectId })}>{archiveProject.isPending ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />} Archive project</Button>}<p className="mt-3 text-[0.65rem] leading-5 text-muted-foreground">Archiving is reversible. Active revision jobs must finish first.</p></section>
          </aside>
        </div>
      </div>
    </CaspaShell>
  );
}

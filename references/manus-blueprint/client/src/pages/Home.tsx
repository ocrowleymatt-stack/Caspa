import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CaspaMark, CaspaShell } from "@/components/CaspaShell";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { STATE_LABELS, type ProjectState } from "@shared/workflow";
import { ArrowRight, BookOpen, Check, FilePenLine, Library, Loader2, Plus, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const FORMATS = [
  { id: "fiction", label: "Fiction", note: "Novels and short fiction", target: 80000 },
  { id: "non-fiction", label: "Non-fiction", note: "Ideas, argument, evidence", target: 50000 },
  { id: "picture-book", label: "Picture book", note: "Page turns and read-aloud rhythm", target: 700 },
  { id: "script", label: "Script", note: "Stage or screen structure", target: 18000 },
  { id: "essay", label: "Essay", note: "Focused long-form argument", target: 3000 },
  { id: "poetry", label: "Poetry", note: "Sequence, image, and voice", target: 1200 },
  { id: "polish", label: "Polish", note: "Refine an existing manuscript", target: 70000 },
] as const;

function SignInGate({ loading }: { loading: boolean }) {
  return (
    <div className="quiet-grid relative min-h-screen overflow-hidden px-5 py-8 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <div className="flex items-center justify-between"><CaspaMark /><span className="eyebrow hidden sm:block">Private by design</span></div>
        <div className="grid flex-1 items-center gap-14 py-14 lg:grid-cols-[1.15fr_0.85fr]">
          <section>
            <p className="eyebrow mb-5">A controlled editorial workspace</p>
            <h1 className="max-w-4xl text-6xl font-semibold leading-[0.9] tracking-[-0.035em] text-foreground sm:text-7xl lg:text-[6.4rem]">Finish the book<br /><span className="text-primary">without losing the author.</span></h1>
            <p className="mt-8 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">CASPA diagnoses the manuscript you actually wrote, shows its evidence, and waits for your approval before changing a line.</p>
          </section>
          <section className="literary-card relative overflow-hidden p-7 sm:p-9">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <p className="eyebrow">Author sign in</p>
            <h2 className="mt-3 text-4xl font-semibold">Return to your writing desk</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">Your projects, manuscript versions, diagnoses, and revision checkpoints remain separated from every other author.</p>
            <div className="my-7 gold-rule" />
            <div className="space-y-3 text-sm text-foreground/85">
              {["Evidence-backed diagnosis", "Author-approved revision plans", "Restorable manuscript history"].map(item => <div key={item} className="flex items-center gap-3"><span className="grid size-6 place-items-center rounded-full bg-primary/12 text-primary"><Check className="size-3.5" /></span>{item}</div>)}
            </div>
            <Button size="lg" className="mt-8 w-full gap-2 font-semibold" disabled={loading} onClick={() => startLogin()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />} Sign in to CASPA
            </Button>
            <p className="mt-4 text-center text-[0.68rem] leading-5 text-muted-foreground">One secure sign-in. No provider keys or model diagnostics in your workspace.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Launchpad({ authorName }: { authorName: string }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("fiction");
  const selected = useMemo(() => FORMATS.find(item => item.id === format)!, [format]);
  const [premise, setPremise] = useState("");
  const [title, setTitle] = useState("");
  const [projectAuthor, setProjectAuthor] = useState(authorName);
  const [target, setTarget] = useState<number>(selected.target);
  const create = trpc.projects.create.useMutation({
    onSuccess: async project => { await utils.projects.list.invalidate(); setLocation(`/projects/${project.id}?view=draft`); },
    onError: () => toast.error("The project could not be created. Your entries are still here."),
  });

  const chooseFormat = (id: (typeof FORMATS)[number]["id"], defaultTarget: number) => { setFormat(id); setTarget(defaultTarget); };
  return (
    <section className="literary-card p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="eyebrow">New project</p><h2 className="mt-2 text-4xl font-semibold">What are you making?</h2></div>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">Choose the form first. CASPA then opens Draft with CASPA—the private, approval-gated first chapter workspace.</p>
      </div>
      <div className="mt-7 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {FORMATS.map(item => (
          <button key={item.id} type="button" onClick={() => chooseFormat(item.id, item.target)} className={`rounded-xl border p-4 text-left transition active:scale-[0.98] ${format === item.id ? "border-primary/70 bg-primary/10 shadow-lg shadow-primary/5" : "border-border bg-black/10 hover:border-primary/35 hover:bg-secondary"}`}>
            <span className={`font-display text-xl font-semibold ${format === item.id ? "text-primary" : "text-foreground"}`}>{item.label}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.note}</span>
          </button>
        ))}
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_240px]">
        <div className="space-y-2"><Label htmlFor="premise">Premise or purpose</Label><Textarea id="premise" value={premise} onChange={event => setPremise(event.target.value)} placeholder="A grieving archivist discovers that the city has been editing its own history…" className="min-h-28 bg-black/15 leading-6" /></div>
        <div className="space-y-5">
          <div className="space-y-2"><Label htmlFor="title">Working title <span className="text-muted-foreground">(optional)</span></Label><Input id="title" value={title} onChange={event => setTitle(event.target.value)} placeholder="CASPA can derive one" className="bg-black/15" /></div>
          <div className="space-y-2"><Label htmlFor="projectAuthor">Author name</Label><Input id="projectAuthor" value={projectAuthor} onChange={event => setProjectAuthor(event.target.value)} placeholder="Name for export metadata" className="bg-black/15" /></div>
          <div className="space-y-2"><Label htmlFor="target">Target words</Label><Input id="target" type="number" min={50} max={250000} value={target} onChange={event => setTarget(Number(event.target.value))} className="bg-black/15" /></div>
        </div>
      </div>
      <div className="mt-7 flex justify-end">
        <Button size="lg" className="gap-2 px-6 font-semibold" disabled={premise.trim().length < 12 || !projectAuthor.trim() || create.isPending} onClick={() => create.mutate({ format, premise, targetWordCount: target, title: title.trim() || undefined, authorName: projectAuthor.trim() })}>
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Create project &amp; draft with CASPA <ArrowRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const projects = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  if (loading || !isAuthenticated) return <SignInGate loading={loading} />;

  const active = (projects.data || []).filter(project => project.currentState !== "archived");
  return (
    <CaspaShell>
      <div className="container py-10 sm:py-14">
        <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div><p className="eyebrow">Author workspace</p><h1 className="mt-2 text-5xl font-semibold tracking-tight sm:text-6xl">Good evening, {user?.name?.split(" ")[0] || "Author"}.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">One manuscript, one current state, one clear next action.</p></div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-2"><ShieldCheck className="size-3.5 text-primary" /> Private versions</span><span className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-2"><Sparkles className="size-3.5 text-primary" /> Approved changes only</span><Button variant="outline" size="sm" className="gap-2" onClick={() => setLocation("/style-library")}><Library className="size-3.5" /> Style library</Button><Button variant="outline" size="sm" className="gap-2" onClick={() => setLocation("/join")}><UsersRound className="size-3.5" /> Join a desk</Button></div>
        </div>

        {projects.isLoading ? <div className="literary-card grid min-h-56 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div> : (
          <div className="mb-10 grid gap-4 lg:grid-cols-2">
            {active.map(project => (
              <button key={project.id} type="button" onClick={() => setLocation(`/projects/${project.id}`)} className="literary-card group p-6 text-left transition hover:-translate-y-0.5 hover:border-primary/35 active:scale-[0.99]">
                <div className="flex items-start justify-between gap-5"><span className="eyebrow">{project.format.replace("-", " ")}</span><span className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-primary">{STATE_LABELS[project.currentState as ProjectState]}</span></div>
                <h2 className="mt-4 text-3xl font-semibold transition group-hover:text-primary">{project.title}</h2>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{project.premise}</p>
                <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground"><span>{project.wordCount.toLocaleString()} / {project.targetWordCount.toLocaleString()} words</span><span className="flex items-center gap-2 text-foreground">{project.currentState === "draft" ? "Draft with CASPA" : "Open next step"} <ArrowRight className="size-3.5 text-primary" /></span></div>
              </button>
            ))}
            {!active.length && <div className="literary-card grid min-h-56 place-items-center p-8 text-center lg:col-span-2"><div><FilePenLine className="mx-auto size-7 text-primary" /><h2 className="mt-4 text-3xl font-semibold">Your desk is clear</h2><p className="mt-2 text-sm text-muted-foreground">Start with a form, a premise, and a target.</p></div></div>}
          </div>
        )}
        <Launchpad authorName={user?.name || "Author"} />
      </div>
    </CaspaShell>
  );
}

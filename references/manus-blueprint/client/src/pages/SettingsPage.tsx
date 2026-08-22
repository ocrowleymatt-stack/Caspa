import { useAuth } from "@/_core/hooks/useAuth";
import { CaspaShell } from "@/components/CaspaShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadTextFile, parseCaspaError } from "@/lib/caspaError";
import { trpc } from "@/lib/trpc";
import { ArchiveRestore, Download, HardDriveDownload, Loader2, LogOut, ShieldAlert, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function SettingsPage() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const projects = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const backups = trpc.settings.backups.useQuery(undefined, { enabled: isAuthenticated });
  const [projectId, setProjectId] = useState(0);
  const [projectConfirmation, setProjectConfirmation] = useState("");
  const [accountConfirmation, setAccountConfirmation] = useState("");

  const selectedProject = projects.data?.find(project => project.id === projectId);
  const createBackup = trpc.settings.createBackup.useMutation({
    onSuccess: async () => { toast.success("Encrypted account backup created."); await utils.settings.backups.invalidate(); },
    onError: error => toast.error(parseCaspaError(error, "The backup could not be created. Your projects are unchanged.").message),
  });
  const exportData = trpc.settings.exportData.useMutation({
    onSuccess: file => downloadTextFile(file.filename, file.mimeType, file.content),
    onError: error => toast.error(parseCaspaError(error, "Your account export could not be prepared.").message),
  });
  const deleteProject = trpc.settings.deleteProject.useMutation({
    onSuccess: async () => { toast.success("Project deleted."); setProjectId(0); setProjectConfirmation(""); await utils.projects.list.invalidate(); },
    onError: error => toast.error(parseCaspaError(error, "The project was not deleted. Type its exact title to confirm.").message),
  });
  const deleteAccount = trpc.settings.deleteAccount.useMutation({
    onSuccess: () => { toast.success("Your CASPA account and projects were deleted."); setLocation("/"); },
    onError: error => toast.error(parseCaspaError(error, "The account was not deleted. Type the confirmation phrase exactly.").message),
  });

  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  if (!isAuthenticated) { setLocation("/"); return null; }

  return (
    <CaspaShell>
      <div className="container py-10 sm:py-14">
        <p className="eyebrow">Settings</p>
        <h1 className="mt-2 text-5xl font-semibold sm:text-6xl">Account & data</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">Only the controls that belong to an author: identity, exports, backups, and deletion.</p>

        <div className="mt-9 grid gap-5 lg:grid-cols-2">
          <section className="literary-card p-6 sm:p-7">
            <div className="flex items-start gap-4"><span className="grid size-10 place-items-center rounded-full border border-primary/25 bg-primary/8 text-primary"><UserRound className="size-4" /></span><div><p className="eyebrow">Account</p><h2 className="mt-2 text-3xl font-semibold">Author identity</h2></div></div>
            <dl className="mt-6 divide-y divide-border rounded-xl border border-border bg-black/15 px-4">
              <div className="flex items-center justify-between gap-5 py-4"><dt className="text-xs text-muted-foreground">Name</dt><dd className="text-sm font-semibold">{user?.name || "Author"}</dd></div>
              <div className="flex items-center justify-between gap-5 py-4"><dt className="text-xs text-muted-foreground">Email</dt><dd className="truncate text-sm font-semibold">{user?.email || "Not provided"}</dd></div>
              <div className="flex items-center justify-between gap-5 py-4"><dt className="text-xs text-muted-foreground">Access</dt><dd className="text-sm font-semibold capitalize">{user?.role || "user"}</dd></div>
            </dl>
            <Button variant="outline" className="mt-5" onClick={() => logout()}><LogOut className="size-4" /> Sign out</Button>
          </section>

          <section className="literary-card p-6 sm:p-7">
            <div className="flex items-start gap-4"><span className="grid size-10 place-items-center rounded-full border border-primary/25 bg-primary/8 text-primary"><Download className="size-4" /></span><div><p className="eyebrow">Portability</p><h2 className="mt-2 text-3xl font-semibold">Export your data</h2></div></div>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">Download your project records, manuscript versions, diagnoses, plans, jobs, preflights, and upload metadata as one JSON archive.</p>
            <Button className="mt-6" disabled={exportData.isPending} onClick={() => exportData.mutate()}>{exportData.isPending ? <Loader2 className="size-4 animate-spin" /> : <HardDriveDownload className="size-4" />} Prepare account export</Button>
          </section>

          <section className="literary-card p-6 sm:p-7 lg:col-span-2">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex items-start gap-4"><span className="grid size-10 place-items-center rounded-full border border-primary/25 bg-primary/8 text-primary"><ArchiveRestore className="size-4" /></span><div><p className="eyebrow">Backups</p><h2 className="mt-2 text-3xl font-semibold">Create a restorable record</h2></div></div><Button variant="outline" disabled={createBackup.isPending} onClick={() => createBackup.mutate()}>{createBackup.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArchiveRestore className="size-4" />} Create backup</Button></div>
            <div className="mt-6 space-y-2">{backups.isLoading ? <div className="grid h-24 place-items-center"><Loader2 className="size-5 animate-spin text-primary" /></div> : backups.data?.length ? backups.data.map(backup => <a key={backup.id} href={backup.storageUrl} className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-black/15 p-4 transition hover:border-primary/30 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold">Backup #{backup.id}</p><p className="mt-1 text-xs text-muted-foreground">{backup.projectCount} projects · {new Date(backup.createdAt).toLocaleString()}</p></div><span className="text-xs font-semibold text-primary">Download backup</span></a>) : <div className="rounded-xl border border-dashed border-border p-7 text-center text-sm text-muted-foreground">No backups yet. Create one before major manuscript work or account changes.</div>}</div>
          </section>

          <section className="literary-card border-destructive/20 p-6 sm:p-7">
            <div className="flex items-start gap-4"><span className="grid size-10 place-items-center rounded-full border border-destructive/30 bg-destructive/10 text-red-300"><Trash2 className="size-4" /></span><div><p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-red-300">Project deletion</p><h2 className="mt-2 text-3xl font-semibold">Delete one project</h2></div></div>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">This permanently removes the selected project and its versions. Create a backup first if you may need the manuscript later.</p>
            <div className="mt-5 space-y-4"><div className="space-y-2"><Label htmlFor="deleteProject">Project</Label><select id="deleteProject" value={projectId} onChange={event => { setProjectId(Number(event.target.value)); setProjectConfirmation(""); }} className="h-10 w-full rounded-md border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-primary"><option value={0}>Select a project</option>{projects.data?.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></div>{selectedProject && <div className="space-y-2"><Label htmlFor="projectConfirmation">Type “{selectedProject.title}”</Label><Input id="projectConfirmation" value={projectConfirmation} onChange={event => setProjectConfirmation(event.target.value)} className="bg-black/15" /></div>}<Button variant="destructive" disabled={!selectedProject || projectConfirmation !== selectedProject.title || deleteProject.isPending} onClick={() => selectedProject && deleteProject.mutate({ projectId: selectedProject.id, confirmation: projectConfirmation })}>{deleteProject.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete project permanently</Button></div>
          </section>

          <section className="literary-card border-destructive/20 p-6 sm:p-7">
            <div className="flex items-start gap-4"><span className="grid size-10 place-items-center rounded-full border border-destructive/30 bg-destructive/10 text-red-300"><ShieldAlert className="size-4" /></span><div><p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-red-300">Account deletion</p><h2 className="mt-2 text-3xl font-semibold">Close the writing desk</h2></div></div>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">This permanently deletes the account and every project. Download an account export or create a backup first.</p>
            <div className="mt-5 space-y-4"><div className="space-y-2"><Label htmlFor="accountConfirmation">Type “DELETE MY CASPA ACCOUNT”</Label><Input id="accountConfirmation" value={accountConfirmation} onChange={event => setAccountConfirmation(event.target.value)} className="bg-black/15" /></div><Button variant="destructive" disabled={accountConfirmation !== "DELETE MY CASPA ACCOUNT" || deleteAccount.isPending} onClick={() => deleteAccount.mutate({ confirmation: accountConfirmation })}>{deleteAccount.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />} Delete account permanently</Button></div>
          </section>
        </div>
      </div>
    </CaspaShell>
  );
}

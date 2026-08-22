import { useAuth } from "@/_core/hooks/useAuth";
import { CaspaMark, CaspaShell } from "@/components/CaspaShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseCaspaError } from "@/lib/caspaError";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, KeyRound, Loader2, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function JoinCollaborationPage() {
  const { isAuthenticated, loading } = useAuth(); const [, setLocation] = useLocation(); const [code, setCode] = useState("");
  const accept = trpc.collaboration.accept.useMutation({ onSuccess: result => { toast.success(`You are now an active ${result.role} on this project.`); setLocation(`/projects/${result.projectId}/approvals`); }, onError: error => toast.error(parseCaspaError(error, "This invitation could not be accepted. Confirm the code and invited email.").message) });
  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  if (!isAuthenticated) { setLocation("/"); return null; }
  return <CaspaShell><div className="container flex min-h-[calc(100vh-80px)] max-w-3xl items-center py-10"><section className="literary-card relative w-full overflow-hidden p-7 sm:p-10"><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" /><button type="button" onClick={() => setLocation("/")} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-primary"><ArrowLeft className="size-3.5" /> Author workspace</button><div className="mt-10 grid place-items-center"><span className="grid size-12 place-items-center rounded-full border border-primary/35 bg-primary/10 text-primary"><UsersRound className="size-5" /></span></div><p className="mt-7 text-center eyebrow">Private project invitation</p><h1 className="mt-2 text-center text-5xl font-semibold">Join a writing desk.</h1><p className="mx-auto mt-4 max-w-lg text-center text-sm leading-7 text-muted-foreground">Enter the one-time code shared by the project author. CASPA will verify that your signed-in email matches the invitation before activating any editor or designer access.</p><div className="mx-auto mt-8 max-w-md"><Input value={code} onChange={event => setCode(event.target.value.trim())} placeholder="Paste private invite code" className="h-12 bg-black/15 text-center tracking-[0.08em]" /><Button size="lg" className="mt-4 w-full" disabled={code.length < 12 || accept.isPending} onClick={() => accept.mutate({ inviteCode: code })}>{accept.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Verify & join project</Button></div><p className="mt-5 text-center text-xs leading-5 text-muted-foreground">A code cannot grant access on its own. It must match the email selected by the author and can be revoked at any time.</p></section></div></CaspaShell>;
}

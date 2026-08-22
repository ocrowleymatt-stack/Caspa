import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Feather, LogOut, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { ReactNode } from "react";

export function CaspaMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-lg shadow-primary/5">
        <Feather className="size-4" strokeWidth={1.5} />
      </div>
      {!compact && (
        <div>
          <div className="font-display text-2xl font-semibold leading-none tracking-[0.08em] text-foreground">CASPA</div>
          <div className="mt-1 text-[0.58rem] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Manuscript development</div>
        </div>
      )}
    </div>
  );
}

export function CaspaShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl">
        <div className="container flex h-[4.75rem] items-center justify-between gap-4">
          <Link href="/" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"><CaspaMark /></Link>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-foreground">{user?.name || "Author"}</p>
              <p className="text-[0.65rem] text-muted-foreground">Private writing desk</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => setLocation("/settings")} className="text-muted-foreground hover:text-primary">
              <Settings className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => logout()} className="text-muted-foreground hover:text-primary">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

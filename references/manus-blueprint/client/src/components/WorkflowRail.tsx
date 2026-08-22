import { Check } from "lucide-react";
import { PROJECT_STATE_ORDER, STATE_LABELS, type ProjectState } from "@shared/workflow";

export function WorkflowRail({ state }: { state: ProjectState }) {
  const visibleStates = PROJECT_STATE_ORDER.filter(item => item !== "archived");
  const currentIndex = state === "archived" ? visibleStates.length : visibleStates.indexOf(state);
  return (
    <div aria-label="Project workflow">
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-4"><div><p className="text-[0.58rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">Current folio</p><p className="mt-1 font-display text-xl font-semibold text-primary">{STATE_LABELS[state]}</p></div><span className="text-xs text-muted-foreground">{Math.min(currentIndex + 1, visibleStates.length)} / {visibleStates.length}</span></div>
        <div className="mt-3 h-px overflow-hidden bg-border"><div className="h-full bg-primary" style={{ width: `${Math.max(4, Math.min(100, ((currentIndex + 1) / visibleStates.length) * 100))}%` }} /></div>
      </div>
      <div className="hidden overflow-x-auto pb-2 sm:block">
      <ol className="flex min-w-[1160px] items-center">
        {visibleStates.map((item, index) => {
          const complete = index < currentIndex || state === "archived";
          const active = item === state;
          return (
            <li key={item} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span className={`grid size-7 place-items-center rounded-full border text-[0.65rem] font-bold transition ${complete ? "border-border bg-secondary text-muted-foreground" : active ? "border-primary bg-primary/15 text-primary ring-4 ring-primary/10" : "border-border bg-secondary text-muted-foreground"}`}>
                  {complete ? <Check className="size-3.5" strokeWidth={2} /> : index + 1}
                </span>
                <span className={`whitespace-nowrap text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${active ? "text-primary" : complete ? "text-foreground" : "text-muted-foreground"}`}>{STATE_LABELS[item]}</span>
              </div>
              {index < visibleStates.length - 1 && <div className={`mx-3 h-px flex-1 ${index < currentIndex ? "bg-border" : "bg-border/60"}`} />}
            </li>
          );
        })}
      </ol>
      </div>
    </div>
  );
}

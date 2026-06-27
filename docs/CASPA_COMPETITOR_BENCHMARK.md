# CASPA Competitor Benchmark

**Date:** June 2025  
**Production branch:** `caspa-studio`  
**Purpose:** Compare CASPA Studio against major author tools and general-purpose AI assistants. Inform a ranked roadmap focused on trust, workflow polish, and deliberate gaps—not feature parity for its own sake.

---

## Summary

CASPA’s differentiation is **local-first orchestration**: manuscript safety (outputs before apply), project bible as living memory, Gold Pass synthesis, awards lenses, agent swarm critique, and Novel Write Pro’s multi-pass drafting—all in one warm writer room. Competitors generally win on **polish, onboarding, export/publishing, and mobile**. CASPA must match on **trust/safety UX** and **finding the next step** before chasing advanced AI gimmicks.

**Forge decision:** **B — messy notes routed into Bible, Research, Structure, and Outputs.** Forge stays visible under Producer legacy with a clear banner; it is not a primary author entry point.

**Studio Command decision:** **A — project-aware command layer.** Scoped navigation and actions when a project is active; not a generic chat box.

---

## Competitor Matrix

| Competitor | They do better | CASPA does better | CASPA must match | CASPA should surpass | CASPA should ignore |
|------------|----------------|-------------------|------------------|----------------------|---------------------|
| **Sudowrite** | Inline AI in the draft; fast brainstorm/expand; polished onboarding; cloud convenience | Outputs-first safety; Gold Pass + awards lenses; local Ollama path; project bible + research desk integration; multi-tool workbench | Clear “what happens next” after AI runs; visible progress on long runs; one-click continue without duplicate projects | Orchestrated critique (plan → draft → critic → rewrite); award-target rewriting with provenance | Social/community features; infinite prompt toys unrelated to manuscript |
| **Novelcrafter** | Codex/bible UX; scene/chapter cards; timeline; clean project hub | Novel Write Pro depth; Agent Swarm; Pier Builder; import review pipeline; outputs archive with apply semantics | Bible empty/error states; workbench source selector wired everywhere; chapter ↔ output lineage visible | Gold + awards + swarm as one elevation stack; import structure detection | Their exact codex field schema |
| **Scrivener** | Deep structure (binder, snapshots, compile); offline-native; industry-standard compile | Modern AI elevation (Gold, improve, continue); browser access; warm writer-room chapter editor | Snapshot/version clarity in UI; compile/export presets (EPUB/PDF/DOCX) | AI revisions as named outputs with apply confirmation | Full binder complexity clone |
| **Dabble** | Simple goal tracking; clean chapter flow; low learning curve | Serious AI pipeline; research desk; awards shelf | Blank project truly blank; obvious primary action per room mode | Single workbench that scales from blank → manuscript → polish | Gamified streaks |
| **Plottr** | Visual timelines; series planning; character arcs at a glance | Manuscript-first AI; structure detection from import | Visual structure summary after import; plot ↔ chapter linking | AI-suggested structure from bible + manuscript | Full timeline product clone |
| **Atticus** | Book formatting; export to print/ebook; chapter templates | Creative drafting + elevation; awards targeting | Export/publishing pack quality; one-click “export manuscript” | Award-aware polish passes before export | Atticus-level typographic fine control (phase 2) |
| **Reedsy Studio** | Collaboration, marketplace, professional export | Local-first privacy; no multi-user complexity; integrated AI rooms | Export quality; professional manuscript formatting | Private award-target workflow without marketplace noise | Freelancer marketplace |
| **ChatGPT / Claude / Gemini** | General reasoning; fast iteration; no setup | Project persistence; bible; outputs archive; apply safety; provider routing; Novel Write Pro orchestration | Provider failure messaging with actionable cause; project-scoped context | End-to-end author workflow in one app—not paste loops | Competing as generic chat |

---

## Ranked Roadmap

### Tier 1 — Must-have trust & safety (next build)

1. **Manuscript safety visible everywhere** — Original preserved label on overview; apply always confirms; continue append confirms (done in audit pass).
2. **No duplicate projects** — Casper binds to `?projectId=` when opened from project (done).
3. **Outputs before overwrite** — Improve/Gold/Continue save outputs; apply is explicit (existing; reinforced).
4. **Workbench source truth** — Reset stale source on project switch; `extractOutputText` for revised outputs (done).
5. **Gold Pass confirmation** — No silent auto-run from `?gold=1` (done).
6. **Provider errors** — Surface Ollama/cloud/credit cause at mutation sites (partial; next: inline status on long runs).

### Tier 2 — Must-have author workflow polish

1. **Room-mode primary actions** — Overview “Start here” per blank/manuscript/bible/research/output (existing; keep tightening copy).
2. **Long-run progress** — Novel Write Pro / Gold / Swarm: step labels + pulse, not spinners alone.
3. **Outputs hub clarity** — Open → detail with Continue/Gold/Apply; remove duplicate list actions (done).
4. **Import review** — Paste path should offer same structure hints as upload (wizard gap).
5. **Bible first-run** — Empty/error shell with Generate, not infinite spinner (done).
6. **Studio Command** — Project-aware routes only; hide vague global ask (consolidation done).

### Tier 3 — Export & publishing gaps

1. Manuscript export presets (DOCX, Markdown bundle, “clean manuscript”).
2. Production pack / show materials export from musical mode.
3. Print-ready pipeline (Atticus/Reedsy class)—later.

### Tier 4 — Versioning & snapshot gaps

1. Chapter history UI prominence (restore exists; expose diff preview).
2. Project-level snapshot (“before Gold apply”).
3. Output lineage graph (parent output → child continue/gold).

### Tier 5 — Optional advanced AI

1. Inline selection rewrite in chapter editor (Sudowrite-style)—only after Tier 1–2 stable.
2. Visual plot timeline from structure detection.
3. Multi-model routing UI for cost/quality tradeoffs.

---

## Recommended Next Build

**Ship:** Audit fixes on `caspa-studio` (Casper project binding, Bible empty state, Gold confirm, workbench source reset, overview links).

**Then (single sprint):**

1. Inline provider status on Casper/Gold/Swarm mutations.
2. Novel Write Pro progress steps in UI during ~4–5 min runs.
3. Wizard paste → optional import analysis parity with file upload.
4. Manuscript export from project workbench (Markdown + DOCX).

**Defer:** Full Forge removal (keep legacy banner), mobile layout, collaboration, marketplace integrations.

---

## Acceptance Alignment

| Criterion | Status after audit pass |
|-----------|-------------------------|
| Blank project genuinely blank | Yes — no demo localStorage |
| Manuscript import safe | Yes — source chapter preserved |
| Novel Write Pro from browser | Yes — with project binding fix |
| Gold uses intended source | Improved — workbench reset + output text extraction |
| Outputs easy to find | Yes — hub + detail actions |
| Apply safe & confirmed | Yes — replace/continue confirm |
| Forge/Ask clear or hidden | Forge legacy B; Studio Command A |
| No secrets exposed | Unchanged |
| Fast smoke passes | Verify post-deploy |

---

*Generated as part of the live author workflow audit (Phase 7).*

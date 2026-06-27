# CASPA vs Shakespeare / NovelWrite Pro — Workflow Audit

**Date:** June 2025  
**Reference:** `ocrowleymatt-stack/Shakespeare-` (novel.ocrowley.com / NovelWrite Pro)  
**CASPA branch:** `caspa-studio`

Goal: absorb Shakespeare’s cleaner author path while keeping CASPA’s stronger backend (outputs-first safety, Gold, Swarm, Research, local Ollama).

---

## Executive summary

| Dimension | Shakespeare / NWP | CASPA today | Required change |
|-----------|-------------------|-------------|-----------------|
| Mental model | One project → write → improve | Many tools, many entry points | Single golden path + “More Tools” |
| Landing | Project dashboard with health score | Studio hero + tool grid | Author-first Today with 5 primary actions |
| Writing | WritingStudio: chapter rail + focus editor | Casper + separate chapter editor | Keep warm Casper; add chapter nav + book progress |
| Progress | `writingStatus` string + draft logs | Spinner + ~4 min label | Staged progress component (honest labels) |
| Memory | Style DNA, plot lattice, research in prompts | Bible exists; not always loaded | Book context loader for all major AI runs |
| Structure | Chapters as first-class list | Import analyser exists; blob risk | Structure report + Book Map + missing chapters |
| Outputs | Archive filter in WritingStudio | Outputs hub (strong) | Rename UI to **Saved Writing**; post-run CTAs |
| Safety | Direct chapter update in AutoDrafter | Outputs before apply (stronger) | Keep CASPA safety; add snapshots |

---

## Area comparison

| Area | Shakespeare / NovelWrite Pro does better | CASPA currently does | CASPA change required |
|------|------------------------------------------|----------------------|------------------------|
| **Landing / start** | Clear project picker; immediate “what is this book?” | Studio tagline; tool cards | Today: “What are we making today?” + 5 primary actions |
| **New project** | Type/genre/tone in project creation flow | 7-step wizard (strong but long) | Keep wizard; add “Fix bad project” + paste analysis parity |
| **Editor layout** | Three-rail WritingStudio: chapters / canvas / critique | Full-screen chapter editor (warm) | Add prev/next chapter, position, book progress bar |
| **Writing screen** | Focus mode, archive of sources beside draft | Clean serif canvas | Keep; add “write next chapter” from Book Map |
| **Auto-write flow** | AutoDrafter: pick chapter, word target, live logs | Novel Write Pro: plan→draft→critic→rewrite | Keep NWP pipeline; add book context + staged progress |
| **Loading / progress** | Terminal-style draft logs; audit progress bar | Single pending label | Shared `StagedProgress` for NWP, Gold, Swarm, Finish |
| **Output handling** | Mixed into chapters + “AI Compilation” archive | Dedicated outputs with apply semantics | Label **Saved Writing**; Open/Continue/Finish/Gold CTAs |
| **Navigation** | View switcher: Dashboard, Write, Plot, Characters… | Sidebar + workbench tabs (15+ links) | 10 primary links + More Tools collapse |
| **Button naming** | “Deep Draft”, “Back to Writing” | “Auto-write award draft”, “Improve manuscript” | Add **Finish This Book**, **Fix / Finish a Bad Project** |
| **Empty states** | Dashboard health + “run lattice audit” | Evocative copy on overview | Book Map empty → “Generate finish map” |
| **Export / save** | PublishView + EPUB in Shakespeare | PDF/EPUB jobs; clipboard copy | Markdown + project archive export |
| **Next-step guidance** | Dashboard health score + audit complete banner | Room mode on overview | Overview shows missing chapters + next best action |

---

## Golden CASPA path (target)

```
Start (Today)
  → Blank | Upload | Paste | Fix bad project | Continue book
  → Project Bible
  → Book Map
  → Draft / Continue (Novel Write Pro)
  → Improve / Gold / Swarm
  → Safe apply → Saved Writing
  → Export
```

Every major page shows **one** primary next action.

---

## What CASPA must not copy from Shakespeare

- Direct AI write into chapter without output record (CASPA outputs-first is correct).
- Firebase-only persistence (CASPA local-first SQLite + outputs files).
- Unbounded “generate whole chapter into manuscript” without confirmation on replace.

---

## Implementation priority

1. Book Map + structure report + missing chapter planner  
2. Finish This Book + Trash to Treasure  
3. Book-aware Novel Write Pro context  
4. Saved Writing UX + staged progress  
5. Snapshots + export archive  
6. Sidebar simplification  

---

*Harvest doc for CASPA 10/10–12/10 finished-book build.*

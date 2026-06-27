# CASPA Real Author Workflow Failure Audit

**Branch:** `caspa-studio` · **Baseline:** `53bf89b` · **Live:** https://caspa.ocrowley.com

## Executive summary

CASPA has strong backend capability (sources, structure analysis, NWP, Book Map, outputs registry, safe apply) but the **author-facing model is inverted**: users are sent to **Outputs / Saved Writing** instead of **Current Work**. The Stuart-style manuscript flow works technically but is not obvious. Creative target (word count, reader effect) is partially present in Production Brief but not surfaced as a first-class “Creative Target” step. Scroll/mobile issues were partially fixed in `384bd98` / `53bf89b` but nested workbench tabs and chapter editor still need discipline.

---

## Live complaint audit (1–12)

| # | Complaint | Current reality | Severity |
|---|-----------|-----------------|----------|
| 1 | UI feels slippery | Partially fixed: `overflow-x-hidden`, `page-content`, bottom nav z-index. Workbench tab row still horizontal-scroll. | P2 |
| 2 | Scrolling not vertically locked | App shell uses single `main.page-scroll`. Chapter editor + some pages use nested scroll. | P2 |
| 3 | Containers wobble | Large rounded cards + negative margins on Casper page (`-mx-4`). Reduced on Today/Overview. | P2 |
| 4 | Outputs hard to find | Global nav says “Saved Writing”; buried mentally as archive not “the book”. | **P1** |
| 5 | Outputs hard to apply | Apply lives on Output detail + workbench rail; not beside chapter in Current Work. | **P1** |
| 6 | Cannot read finished/current work | Chapters exist but no dedicated **Read** mode; manuscript tab is a reorder list not reader. | **P1** |
| 7 | Stuart MS not obviously becoming chapters | Structure analyse exists (`POST structure/analyse`) but apply path obscure (`/api/manuscript/import/apply`); no prominent “Create chapters” on Current Work. | **P1** |
| 8 | Not expanding toward target word count | `targetWordCount` on project + `targetLength` on brief; no expansion map UI or progress bar on Current Work. | **P1** |
| 9 | Not asking target length/chapters | Wizard asks target length (words) only; no chapter/scene count or presets. | **P1** |
| 10 | Not asking reader/psychological effect | Brief has tone/audience/successCriteria; no structured reader effect / intensity / avoid list. | **P1** |
| 11 | Not obviously finishing book/play/musical | Book Map + finish-book API exist; entry points scattered (Overview, Book Map tab). | P2 |
| 12 | Too many tools, no clear path | Simplification pass helped (Sources→Plan→Write→Improve→Export) but Write tab still lists units not “Current Work”. | **P1** |

---

## Where things live today

| Question | Answer |
|----------|--------|
| Where does uploaded material go? | **Sources** (`/projects/:id/sources`) as `ProjectAsset` records; import may also create source chapter. |
| Where does the current manuscript live? | **Chapters** collection — viewed via `/projects/:id/manuscript` (list) or chapter editor. |
| Where does the author read the book? | **Nowhere obvious** — must open each chapter in editor. No `/read` route before this build. |
| Where do generated drafts appear? | **Output registry** → UI “Saved Writing” / project outputs tab. |
| Can drafts apply to chapters? | Yes via Output detail **Apply safely** / chapter replace; not inline on Current Work. |
| Can manuscript split into chapters? | Yes — `ImportAnalyser` + `ImportService.apply` with `split-into-units`; analyse at `structure/analyse`. |
| Target word count? | `project.targetWordCount`, `productionBrief.targetLength`. |
| Reader effect? | Only free-text `successCriteria` / `tone` — not structured. |
| Guide Me | Recommends tools (brief, bible, book map) not always manuscript next step. |
| Export-ready draft? | Export uses project manuscript API; warns weakly on missing sections. |

---

## What confuses non-developers (James)

1. “Saved Writing” sounds like the book — it is not; it is a **history of AI runs**.
2. “Write” tab shows draggable units — not a readable manuscript.
3. After upload, no single screen says **“CASPA found 12 chapters — create them?”**
4. Production Wizard vs Plan vs Bible — three planning doors.
5. Novel Write Pro opens new chapter but user may not see it in “the manuscript”.
6. Apply requires finding an output ID in a list.

---

## Product model correction (target state)

| Concept | User label | Route |
|---------|------------|-------|
| Sources | Sources | `/projects/:id/sources` |
| Current Work | Manuscript / Script / Show Book | `/projects/:id/manuscript` |
| Writing History | Writing History (not primary) | `/projects/:id/outputs`, `/outputs` |
| Read | Read current work | `/projects/:id/read` |

---

## What this mega build addresses

1. **Creative Target** fields in Production Brief + wizard step  
2. **Current Work** page upgrade (progress, actions, structure CTA)  
3. **Read mode** route  
4. **Writing History** reframe (labels)  
5. **Guide Me** manuscript-first recommendations  
6. **`structure/apply`** with snapshot  
7. **Ask Casper → Save to Writing History**  
8. **Today** dashboard author cards  
9. **Scroll lock** CSS reinforcement  

## What remains after this slice

- Full three-column workspace (left rail / centre editor / right guide) in one page  
- Generation `destination` metadata on all AI routes  
- Play/musical-specific finish engines UI  
- Natural command routing overhaul  
- QA agents 9.5+ gates (partial addition only)  

---

## Do-not-break checklist

All preserved: auth, NWP, Source Library, Bible, Book Map, Guide Me, Gold, Trash to Treasure, AI router, intimacy, snapshots, exports, fast smoke.

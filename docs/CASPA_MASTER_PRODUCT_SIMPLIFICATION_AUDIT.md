# CASPA Master Product Simplification Audit

**Generated:** 2026-06-27  
**Baseline:** `7bd7932` · branch `caspa-studio` · live https://caspa.ocrowley.com  
**Role:** Read-only product surgeon review before simplification coding.

---

## 1. What CASPA currently is

A private, auth-protected creative production studio: React UI + Express backend, local-first with Ollama fallback, storing projects, manuscripts, source assets, AI outputs, bibles, book maps, and exports on disk/SQLite. It is **much more than a writing app** — it is a multi-module production machine (show factory, music lab, orchestra, wonder, pier builder, forge, etc.) with a **warm writer-room UI** layered on top.

## 2. What CASPA is trying to be

**Any creative material in → guided intelligence → production-ready product out.** The ideal path: add material → choose product → guide → draft → critique → save safely → export professionally.

## 3. What is genuinely commercially valuable

- Universal **Source Library** (assets preserved, classified)
- **Production Wizard** + Production Brief (defines “finished”)
- **Guide Me** (contextual next step)
- **Novel Write Pro** (structured drafting, preserved strings)
- **Book Map** + finish roadmap + missing chapters
- **Trash to Treasure** (rescue without shame)
- **Saved Writing** archive + safe apply + snapshots
- **Gold Pass / Swarm** critique pipeline
- **DOCX/Markdown/export pack**
- **AI Router** with honest provider status
- **Intimacy settings** for adult fiction (respectful UX)
- **Data safety** (originals preserved, snapshots)

## 4. What is confusing

- **Too many nav entry points** with internal module names (Pier Builder, Forge legacy, Show Factory, Wonder, elevation tools)
- **Duplicate “what next?”** paths: Today, Studio Command, Guide Me, Project Overview mode buttons
- **Plan scattered**: Production Wizard (`/start`), Bible tab, Book Map tab, Overview buttons
- **Write scattered**: sidebar “Write” → `/casper`, project “Manuscript”, Novel Write Pro branding
- **Black quote box** on Today reads as a UI bug / heavy block
- **Quick links grid** on Today lists Music, Documents, Studio Command beside core creative path
- **Workbench tab bar** shows 10+ primary tabs — cognitive overload
- **Producer vs Writer mode** toggles advanced nav without clear explanation

## 5. What is duplicated

| Area | Duplication |
|------|-------------|
| Next step | Guide Me, Studio Command, Overview “Start here”, Today CTAs |
| Improve | Gold tab, Swarm tab, Awards Shelf, Improve panel on Overview |
| Sources | Source Library, Forge/intake legacy, Manuscript import |
| Export | Project export tab, global publish routes, Documents page |
| Write | `/casper`, project manuscript, chapter editor continue |

## 6. Hidden but important

- Snapshots / restore before apply
- Production Brief (wizard exists but not obvious post-project-create)
- Intimacy settings (in wizard, not on project settings surface)
- Provider test-all / AI status (top bar, easy to miss on mobile)
- Structure analysis route
- Memory API (no dedicated UI)
- Finish This Book / fill-gap APIs

## 7. Too prominent but secondary

- Music Lab, Show Factory, Show In A Box on sidebar (expert mode)
- Pier Builder as primary workbench tab
- Awards Shelf as primary-adjacent
- Provider status duplicated on Today hero + sidebar panel
- “Secret Weapon cockpit” label ( insider language )

## 8. What should be merged (UX entry, not backend)

- **Plan:** Production Brief + Bible + Book Map → one “Plan” mental model
- **Improve:** Gold + Swarm (+ Awards lenses) → one “Improve” entry with sub-actions
- **Write:** Casper NWP + Continue + chapter editor → one “Write” path
- **Sources:** Source Library + paste/upload on Overview → Sources tab as canonical

## 9. What should be renamed

| Current | Proposed |
|---------|----------|
| Source Library | Sources |
| Project Bible (tab) | Plan (links to bible) |
| Novel Write Pro (nav) | Write (keep NWP strings in tool) |
| Secret Weapon cockpit | Your project |
| Studio Command | Advanced: Command (or hide under Help) |
| Improve (tab) | Improve (keep) |
| Agent Swarm | Improve → Swarm (secondary) |

## 10. What should be hidden under Advanced

- Pier Builder, Wonder, Quality, Taste, Audience, Showstopper, Rehearsal, Producer, Localise, Visuals
- Forge (legacy), Show Factory, Music Lab, Show In A Box (unless user enables Producer mode)
- Awards Shelf (link from Improve)
- Structure (link from Plan or Advanced)
- Admin/QA diagnostics

## 11. What should be automated

- Guide Me recommended action after asset upload
- Production Brief prompt when assets exist but no brief
- Book Map suggestion after bible + manuscript structure
- Output saved toast with link (partially done)
- Provider fallback messaging (partially done)

## 12. Remove only after approval

- Backend modules (show-factory, wonder, etc.) — **do not remove**
- Forge/intake routes — deprecate UI only
- Dick Turpin / Grey Lady — already banned
- Any export format — keep all

## 13. Blocking private beta

- First-time path still feels like a **tool maze** despite Guide Me
- James must discover Sources → Plan → Write without Matthew
- Plan trinity (Brief/Bible/Map) not one obvious step
- Today page visual noise (black block, duplicate CTAs)
- Mobile: improved but menu still long in Producer mode

## 14. What would confuse James/non-developers

- “Pier Builder”, “Room mode”, “Secret Weapon”, “Elevation workbench”
- Three different places to “write”
- Difference between Manuscript tab and chapter editor
- When to use Gold vs Swarm vs Awards Shelf
- Production Wizard vs Project Bible vs Book Map order

## 15. Output quality risks if simplified badly

- Skipping Bible/Book Map context on NWP runs → generic short output
- Hiding Swarm/Gold behind one button without staged progress → feels broken
- Removing provider choice visibility → silent downgrade
- Merging apply flows without snapshot → data loss
- Collapsing intimacy settings → wrong heat level in scenes

---

## Brutally honest summary

### Top 10 UX problems
1. Too many primary navigation items and workbench tabs  
2. Plan workflow split across wizard, bible, book map, overview  
3. Write entry split across Casper, manuscript, chapters  
4. Today page clutter + black quote block  
5. Internal jargon (Pier, Secret Weapon, Room mode)  
6. Duplicate CTAs for continue/rescue/write  
7. Advanced show/music tools visible in default paths  
8. Saved Writing not positioned as “where everything goes” strongly enough  
9. Producer mode exposes 20+ links without guardrails  
10. Help exists but not wired as default escape hatch  

### Top 10 commercial strengths
1. End-to-end material → export pipeline exists  
2. Source Library + receipt/fragment handling  
3. Trash to Treasure differentiation  
4. Safe apply + snapshots (trust)  
5. Book Map + missing chapter drafting  
6. Multi-provider AI with Ollama local-first  
7. Adult fiction settings (market gap)  
8. Saved Writing archive with filters  
9. DOCX + submission export  
10. Critical QA 9.9+ / data safety 10  

### Top 10 simplification opportunities
1. Today: one primary path + three secondary cards  
2. Project workbench: 6 primary tabs, rest secondary  
3. Rename Sources / Plan / Write / Improve / Export  
4. Guide Me on every project page header  
5. Collapse quick links to core four  
6. Remove black block on Today  
7. Move diagnostics to Settings  
8. Default simpleMode=true hides expert nav (already) — enforce copy  
9. Overview workflow strip: Sources → Plan → Write → Improve → Export  
10. Saved Writing cards: Continue / Improve / Export / Apply safely  

### Top 10 things not to touch
1. Novel Write Pro API routes and UI strings  
2. Saved Writing / output registry  
3. Source Library backend + classification  
4. Guide Me / guide-state logic  
5. Snapshot / restore / safe apply  
6. Auth middleware  
7. AI Router / provider test-all  
8. Intimacy settings storage  
9. Trash to Treasure rescue flow  
10. Fast smoke / critical QA gates  

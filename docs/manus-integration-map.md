# Caspa × Manus integrated workspace

Reference: `origin/reference/manus-blueprint` → `references/manus-blueprint/`  
(kept off this branch, off PR #36, and off `main`)

Live base: `feat/caspa-hybrid-v2` (PostgreSQL, immutable versions, SSO, `/legacy` specialist studio)

## Feature mapping

| Manus surface | Existing Caspa engine | Integrated surface |
| --- | --- | --- |
| Home / “What are you making?” | Hybrid Library + LaunchpadView | Library stage: format cards, premise, server `POST /api/projects` |
| File / paste ingest | `caspa.manuscriptSource`, knowledge ingest | Idea stage: text/file/image ingest → project artefacts; manuscript only via explicit version |
| Style / structure rooms | Brainstorm, Story Bible, Character Forge, Psychology, Plot Architect | Structure stage: tools mount in-workspace against the selected Postgres project |
| Draft with CASPA | `/api/v2/.../draft-preview` accept/reject | Draft stage: private preview, reject, accept → immutable version |
| Workshop diagnosis | `/api/v2/.../diagnosis` + CommissionStudio | Workshop stage: evidence findings stay on the server project |
| Revision plan / checkpoints | ManuscriptFixer, AutoDrafter, Scalpel, Gold, Red Pen | Revise stage: native rip-up-and-rebuild + mounted engines |
| Recovery / jobs | `/api/jobs` + recover-job | Finish stage: promote completed jobs; poll metadata only |
| Export preflight | `/api/v2/.../export-preflight` + PublishPack | Publish stage: gate + download verified version |
| Production / design | BookDesignStudio, export PDF | Contextual Design / Proof / Export tools |
| Research desk | ResearchLibrary, IntelligenceLab, `/api/caspa/research` | Idea + Draft tools write notes back to the same project |
| Critic / continuity / facts | CriticSwarm, IntelligenceLab, diagnosis categories | Workshop tools, same project |
| Version history | `caspa_manuscript_versions` | Sidebar + compare; restore creates a new version |
| Collaboration / style library | Not in hybrid-v2 | Deferred; `/legacy` remains |

## Dead / duplicated / browser-only paths (kept, not deleted)

| Path | Status |
| --- | --- |
| `/legacy?tool=…` bounce from Hybrid chips | Replaced by in-workspace mount; legacy route retained |
| `caspa.currentBrief` / `caspa.whitePage` / `caspa.studioCanon.*` | Cache / recovery snapshot only |
| `CaspaRedesign.tsx`, `CaspaStudio.tsx` | Unrouted mocks; unused |
| PrizeCalibrationDashboard mock scores | Still mounted; not treated as a scored gate |
| CoreStatusPanel (unmounted) | Status moved into the desk strip |

## Architectural decisions

1. **One desktop, two stores.** PostgreSQL is canonical. Browser storage is a hydrate/collect cache keyed by the server project, never the source of truth.
2. **Tools read the selected version.** Opening a tool hydrates brief, manuscript, canon, research, and chapters from the open project/version. Closing flushes artefacts via `PATCH`/`/artefacts` and treats manuscript diffs as proposals.
3. **No silent manuscript writes.** Draft previews, rebuild changes, Gold/Scalpel/AutoDrafter output, and ingest promotion require explicit accept. Accept creates a new immutable version.
4. **Guidance, not a lock.** Journey is Library → Idea → Structure → Draft → Workshop → Revise → Finish → Publish. The author may move freely once a project is open.
5. **Polling stays thin.** `/api/v2/projects/:id/workspace` returns metrics, revision, job summaries, and recovery flags — never full manuscript bodies.
6. **Default route unchanged.** `/` remains HybridWorkspace; `/legacy` remains the previous studio. This PR does not retarget `main`.
7. **Manus visuals, Caspa engines.** Desk chrome (obsidian/gold/ivory, literary cards, workflow rail, approval copy) comes from the blueprint. Engines stay the existing React components and `/api/*` routes.

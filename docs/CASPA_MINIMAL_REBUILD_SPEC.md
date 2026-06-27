# CASPA Minimal Rebuild Spec

Ultra-minimal writing surface: one screen, five actions, no visible pipelines or agent chrome.

## Product surface

| Step | User action | What happens (invisible) |
|------|-------------|---------------------------|
| 1 | **Drop** | Files or paste → project assets (`POST /api/projects/:id/assets`) |
| 2 | **Auto Build** | Import/structure → bible → book map → workflow flags |
| 3 | **Auto Write** | Novel Write Pro → safe apply (replace/append) with snapshot |
| 4 | **Improve** | Gold Pass on `current-manuscript` lock → safe apply if no drift |
| 5 | **Export** | Markdown + DOCX download |

Route: **`/write`** (default landing). **Studio mode** link → `/home` for full CASPA.

## Non-negotiables (preserved, hidden)

- Auth remains required (`AuthGuard`).
- Apply always uses `confirmed: true` + snapshot before overwrite.
- Gold drift blocks silent overwrite; improvement saved as alternative output.
- Original assets and manuscript history are never destroyed by minimal actions.

## Backend

- `MinimalWorkflowService` — orchestrates existing services.
- State file: `data/minimal-workflow/{projectId}.json` (`builtAt`, `draftedAt`, `improvedAt`, `exportedAt`, `writeProgress`).
- Routes under `/api/minimal/*` and `/api/projects/:id/minimal/*`.

## Frontend

- `CaspaMinimal.tsx` — drop zone + four action buttons + read preview.
- `MinimalShell.tsx` — full-screen layout without sidebar.
- `api/minimal.ts` — isolated API client (no raw fetch in pages).
- Project id persisted in `localStorage` key `caspa-minimal-project-id`.

## Rollback

- UI-only: remove `/write` route or point index back to `/home`.
- Full: revert commits touching `src/modules/minimal/` and `caspa-ui/src/pages/CaspaMinimal.tsx`.

## QA smoke

1. Login → land on `/write`.
2. Paste note → material count increases.
3. Auto Build → status “Structure ready”.
4. Auto Write → progress bar → preview updates.
5. Improve → no error; drift case shows toast, no silent wipe.
6. Export → DOCX downloads.
7. Studio mode → `/home` still works.

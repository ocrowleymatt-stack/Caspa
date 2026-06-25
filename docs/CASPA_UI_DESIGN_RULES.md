# CASPA Studio — UI/UX Design Rules

**Scope:** Frontend UI design and implementation only. These rules govern `caspa-ui/` — not general backend architecture, module wiring, or server-side feature design.

**Last updated:** 2026-06-23

---

## 1. Core architectural constraints

### Zero authentication UI

CASPA is **local-first, single-user** by default. The UI runs against `http://localhost:3000` with no login flow.

| Rule | Detail |
|------|--------|
| No login/register screens in the default app | Routes like `/login`, `/register` must not gate the app |
| No admin or role UI | No user management, pending approvals, or role badges in the shell |
| No auth wrappers | Do not wrap routes in `AuthGuard` or similar in default mode |
| App entry | Opens directly to **Command Centre** (`/home`) |

Backend multi-user auth may exist behind `AUTH_ENABLED=true` (see `docs/AUTH_AND_MULTIUSER.md`), but **UI design assumes auth is off**. Auth UI must not ship in the default experience.

### API isolation

All HTTP from React components goes through `src/api/*`. **No raw `fetch()` in page or layout components.**

```
pages/*.tsx  →  src/api/<feature>.ts  →  src/api/client.ts  →  Express backend
```

- React Query hooks call API module functions, never `fetch` directly.
- Streaming (`EventSource`), downloads, and multipart uploads live in `client.ts`.
- Each feature gets its own API file (`projects.ts`, `wonder.ts`, `command.ts`, etc.).

### Centralized config

All base URL and response typing lives in **`src/config.ts`** — nowhere else.

```typescript
export const API_BASE = import.meta.env.VITE_API_URL ?? '';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

- `API_BASE` targets the local Express server on port 3000.
- For production same-origin deploy (UI served from Express `public/`), set `VITE_API_URL=''` at build time so requests stay relative.
- `ApiResponse<T>` is the standard envelope for every backend JSON response.

### Standard API envelope

Every function in `src/api/*` returns typed data via `apiCall<T>()` in `client.ts`, which:

1. `fetch(`${API_BASE}${path}`, …)`
2. Parses `{ success, data?, error? }`
3. Throws `ApiError` when `success === false`
4. Returns `data` on success

Pages never parse raw JSON envelopes themselves.

---

## 2. Visual language

### Tailwind-only styling

- Use Tailwind utility classes and `@layer components` tokens in `src/index.css`.
- No CSS modules, styled-components, or inline `<style>` blocks.
- Reuse component classes: `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.label`, `.badge`.

### Dark, distraction-free aesthetic

The UI is a creative workspace — calm, focused, no visual noise.

- **Background:** deep charcoal (`#0f0f13`) with subtle radial gradients
- **Surface:** elevated panels (`#1a1a24`) with soft borders (`border-white/10`)
- **Foreground:** light slate text (`#e2e8f0`); secondary copy uses `text-muted`
- **No bright white chrome**, no light-mode toggle in default design
- Generous whitespace; content max-width (`max-w-3xl` … `max-w-6xl`) per page type

### Color accents

| Token | Role | Usage |
|-------|------|-------|
| **Purple / indigo** | Primary accent | Active nav, links, focus rings, hero gradients (`purple-950`, `accent/15`) |
| **Gold / amber** | Confidence & quality | Publish Confidence, certificates, success highlights (`rgba(201,162,39,…)`) |
| **Emerald** | Healthy / active status | Provider online, backup OK |
| **Red** | Errors & blocked states | Failed requests, validation errors |

Accent color is defined in `tailwind.config.ts` as `accent`. Prefer purple-tinted gradients on hero cards (Command Centre) and gold radial highlights on confidence-related surfaces.

### Typography

| Element | Style |
|---------|-------|
| UI chrome | `font-sans` — Inter, system-ui |
| Manuscript preview | `font-serif` — Lora, Georgia (where prose is shown) |
| Page title | `text-2xl` or `text-3xl font-bold tracking-tight` |
| Section title | `font-semibold` inside `.card` |
| Labels | `.label` — uppercase, `text-xs`, `tracking-wide`, `text-muted` |
| Body / help text | `text-sm text-muted` |

---

## 3. Interaction principles

### Simple vs Expert mode

Controlled by `simpleMode` in Zustand (`src/store/index.ts`).

| Mode | Audience | Visible nav |
|------|----------|-------------|
| **Simple** (default) | Day-to-day creative work | Command Centre, Natural Command, Casper, Projects, Forge, Music, Documents, Publish Confidence, Outputs, Jobs, Settings |
| **Expert** | Power users & production | Simple nav **plus** Show Factory, Music Lab, Show In A Box, Publish, and the full **✨ Elevation** suite (Wonder → Gold) |

Toggle lives in the sidebar header. Expert-only sections must be hidden entirely in Simple mode — not disabled greyed-out links.

### No fake buttons

Every clickable control must do something real:

- Submit → calls an API mutation or navigates
- Disabled state → `disabled` prop with clear reason (e.g. no project selected)
- Never render a button that looks actionable but has no handler

### No blank screens

Every page must render meaningful content in all four states (see below). An empty data array is not an empty page — show guidance and a next step.

---

## 4. Page structure

Every feature page follows this skeleton:

```
┌─────────────────────────────────────────┐
│  Title + icon                           │
│  One-line explanation (what & why)      │
├─────────────────────────────────────────┤
│  Primary action (btn-primary)           │
│  Optional: project selector / inputs    │
├─────────────────────────────────────────┤
│  Content area OR state message          │
│  (results, cards, lists, previews)      │
└─────────────────────────────────────────┘
```

### Required states (every page)

| State | Pattern |
|-------|---------|
| **Loading** | Centered `Loader2` spinner (`animate-spin text-accent`) or inline skeleton |
| **Error** | Toast via `useToast()` + inline message if query fails |
| **Empty** | Friendly copy explaining what to do first — never a white void |
| **Success / data** | `.card` or `ResultCard` with structured output |

Use React Query's `isLoading`, `isError`, and empty-array checks consistently.

---

## 5. Component patterns

### Layout

`src/components/Layout.tsx` — app shell:

```
Sidebar | TopBar + main (Outlet) | AIPanel (optional) | CommandPalette
```

- Full-height flex column; main scrolls independently
- AI panel slides in from the right when open
- Chapter editor renders outside Layout (full-screen writing mode)

### Command Centre

`src/pages/CommandCentre.tsx` — default home:

- Hero card with gradient, project context, Casper status pill
- Grid of quick-link cards to primary workflows
- No auth, no setup wizard — immediate access to tools

### ElevationWorkbench

`src/components/ElevationWorkbench.tsx` — shared wrapper for Phase 6 elevation pages:

- Title + subtitle + icon
- Project selector (syncs with sidebar active project)
- Empty state: "Select a project to get started"
- Children render via render-prop: `({ projectId, setProjectId }) => …`
- Helpers: `ResultCard`, `JsonPreview` for structured API output

Elevation pages (Wonder, Quality, Taste, … Gold) should use this wrapper — do not duplicate project-picker boilerplate.

### Sidebar

- Simple/Expert toggle + active project dropdown
- Nav groups: core → expert extras → ✨ Elevation (expert only) → Manuscript (when project active)
- Footer: command palette shortcut (`⌘K`) only — **no user account block in default UI**

### TopBar

- Breadcrumbs derived from route + loaded project/chapter names
- Command palette search trigger

---

## 6. Data fetching pattern

```tsx
// ✅ Correct — page component
const { data, isLoading, isError } = useQuery({
  queryKey: ['feature', projectId],
  queryFn: () => listThings(projectId),
  enabled: Boolean(projectId),
});

// ✅ Correct — mutation
const mutation = useMutation({
  mutationFn: () => runAction(projectId),
  onSuccess: () => { refetch(); toast.success('Done'); },
  onError: (e: Error) => toast.error(e.message),
});

// ❌ Wrong — never in pages
const res = await fetch(`${API_BASE}/api/...`);
```

---

## 7. File map (UI layer)

| Path | Purpose |
|------|---------|
| `src/config.ts` | `API_BASE`, `ApiResponse<T>` |
| `src/api/client.ts` | `apiCall`, `apiStream`, `apiDownload`, storage helpers |
| `src/api/*.ts` | Feature-specific API functions |
| `src/pages/*.tsx` | Route pages |
| `src/components/Layout.tsx` | App shell |
| `src/components/Sidebar.tsx` | Navigation |
| `src/components/ElevationWorkbench.tsx` | Elevation page wrapper |
| `src/store/index.ts` | Zustand: project, mode, jobs, UI chrome |
| `src/index.css` | Tailwind layers + component tokens |
| `tailwind.config.ts` | Color palette, fonts |

---

## 8. Compliance checklist

Before merging UI work, verify:

- [ ] No `fetch(` in `src/pages/` or `src/components/` (except `src/api/client.ts`)
- [ ] `config.ts` exports `API_BASE` and `ApiResponse<T>`
- [ ] Page has title, explanation, primary action, and all four states
- [ ] Tailwind-only; uses `.card`, `.btn-*`, `.input` tokens
- [ ] Simple mode hides expert/elevation nav items
- [ ] No login/register/admin routes or auth shell in default build
- [ ] App opens to `/home` (Command Centre) without redirect to login

---

## 9. Related docs

| Doc | Scope |
|-----|-------|
| `docs/CASPA_ARCHITECTURE_AND_WIRING.md` | Full-stack architecture (backend + UI deploy) |
| `docs/AUTH_AND_MULTIUSER.md` | Optional backend auth — **not part of default UI design** |
| `docs/PHASE_6_AWARD_ENGINE_ARCHITECTURE.md` | Elevation pipeline (Wonder → Gold) |

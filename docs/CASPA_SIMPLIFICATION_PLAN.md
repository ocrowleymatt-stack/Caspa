# CASPA Simplification Plan

**Principle:** Hide complexity; do not discard capability.

## Categories

| Cat | Definition |
| --- | ----------- |
| A | Core path — always visible |
| B | Contextual — when useful |
| C | Advanced — available, not primary |
| D | Admin/dev — not normal user |
| E | Duplicates — merge entry points |

## Core path (target)

1. Add material → 2. Choose product → 3. Generate plan → 4. Draft → 5. Improve → 6. Save → 7. Export

## Feature map

| Feature | Action | Location | Rationale | Risk |
| ------- | ------ | -------- | --------- | ---- |
| Today | Keep | Global nav | Home cockpit | Low |
| Projects | Keep | Global nav | Room container | Low |
| Write (Casper) | Keep | Global nav | Primary draft entry | Low — keep NWP strings inside |
| Saved Writing | Keep | Global nav | Archive trust | Low |
| Help | Keep | Global nav + bottom nav | Escape hatch | Low |
| Settings | Keep | More menu | Config + AI status | Low |
| Production Wizard | Keep | Today secondary + Guide | Defines product | Low |
| Guide Me | Keep | Top bar everywhere | One next step | Low |
| Sources | Rename | Project tab | Clearer than Source Library | Low |
| Plan (Bible) | Rename tab | Project tab | Mental model | Low — route unchanged |
| Book Map | Merge UX | Plan secondary / tab | Structure roadmap | Low |
| Manuscript | Rename Write | Project tab | Matches global Write | Low |
| Improve (Gold) | Keep | Project tab | Critique entry | Low |
| Swarm | Hide | Improve secondary | Advanced critique | Low |
| Export | Keep | Project tab | Professional out | Low |
| Trash to Treasure | Keep | Today secondary | Differentiation | Low |
| Structure | Hide | Advanced | Power users | Low |
| Pier Builder | Hide | Advanced | Jargon | Low |
| Research | Contextual | Advanced / project | When research-led mode | Low |
| Awards Shelf | Hide | Advanced / Improve | Niche | Low |
| Studio Command | Hide | Advanced | Overlaps Guide Me | Low |
| Music/Documents | Hide | Advanced | Off core path | Low |
| Show Factory stack | Hide | Producer mode only | Different product | Low |
| Wonder/Quality/Taste | Hide | Producer mode | Elevation suite | Low |
| Forge | Hide | Advanced label legacy | Duplicate intake | Low |
| Provider test-all | Move | Settings | Not creative path | Low |
| QA scripts | D | Server only | Dev | None |

## Do not remove (backend)

All `src/modules/*` routes remain mounted. UI-only hiding.

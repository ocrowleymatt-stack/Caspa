# CASPA Output Quality Protection Rules

Simplification must **not** make CASPA dumber.

## Context that must reach generation

| Context | Source | Must not drop |
| ------- | ------ | ------------- |
| Project Bible | `/api/projects/:id/bible` | Premise, characters, tone |
| Book Map | book-map service | Gaps, arcs, next chapter |
| Source assets | studio assets API | Selected sources |
| Production Brief | production-brief | Product type, length, success criteria |
| Memory | memory API | Style rules, corrections |
| Prior outputs | output registry | Continue/improve chains |
| Intimacy settings | intimacy-settings | Heat, boundaries |

## Rules

1. **Hide complexity, do not discard context** — UI may collapse tabs; API calls must still pass bible/map/memory.
2. **Automate planning where sensible** — Guide Me recommends bible/map; never skip silently.
3. **Surface only the next useful decision** — one primary CTA per screen.
4. **Save every generated artifact** — all AI runs → Saved Writing.
5. **Preserve originals** — source assets, import source chapters, snapshots before apply.
6. **Never silently downgrade provider** — show engine + fallback reason.
7. **Never skip bible/map for long-form NWP** — warn if missing, don't block but don't pretend brief exists.
8. **Never collapse a book into a short answer** — target length from brief/project honored.
9. **Fewer clicks ≠ less thinking** — Guide Me explains why.
10. **Critique before destructive apply** — Gold/Swarm reports stay available.

## Simplification allowed

- Rename tabs  
- Hide advanced links  
- Merge CTAs if equivalent action remains  
- Default simpleMode hiding expert nav  
- Remove decorative UI (black blocks, duplicate status)  

## Simplification forbidden without approval

- Remove bible/book-map from NWP request payload  
- Remove snapshot before apply  
- Remove output save  
- Remove asset preservation  
- Remove intimacy guardrails  
- Remove provider fallback chain  

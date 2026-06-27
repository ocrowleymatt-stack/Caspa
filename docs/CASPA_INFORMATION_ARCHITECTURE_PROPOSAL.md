# CASPA Information Architecture Proposal

**Status:** Proposal only — partial implementation in Phase 8.

## Global navigation (target: 7 items)

| # | Label | Route | Notes |
| - | ----- | ----- | ----- |
| 1 | Today | `/home` | Cockpit |
| 2 | Projects | `/projects` | All rooms |
| 3 | Write | `/casper` | Novel Write Pro inside |
| 4 | Saved Writing | `/outputs` | Archive |
| 5 | Help | `/help` | Practical guides |
| 6 | Settings | `/settings` | AI status, account |
| 7 | *(mobile)* Guide | drawer | Not a route |

**More menu (collapsed):** Production Wizard, Studio Command, Music, Documents, Export (global), Producer tools.

## Inside a project (target: 6 primary tabs)

| Tab | Maps from | Route |
| --- | --------- | ----- |
| Overview | Overview | `/projects/:id` |
| Sources | Source Library | `/projects/:id/sources` |
| Plan | Bible (+ brief/book map links) | `/projects/:id/bible` primary; book-map secondary |
| Write | Manuscript + chapters | `/projects/:id/manuscript` |
| Improve | Gold (+ swarm) | `/projects/:id/gold` |
| Saved Writing | Outputs | `/projects/:id/outputs` |
| Export | Export pack | `/projects/:id/export` |

**Secondary (Advanced dropdown / collapsed tabs):** Book Map, Structure, Research, Swarm, Awards, Pier, Trash to Treasure.

## Old → new mapping

| Old | New |
| --- | --- |
| Source Library | Sources |
| Production Brief + Bible + Book Map | Plan (Bible tab labeled Plan; wizard linked) |
| Novel Write Pro + Continue + Finish | Write |
| Gold + Swarm + Critic | Improve |
| Outputs | Saved Writing |
| Export Pack | Export |
| Guide Me | Persistent drawer (unchanged) |
| Provider testing | Settings |
| QA/diagnostics | Admin only |

## Mobile bottom nav (keep)

Today · Projects · Write · Saved · Help · Guide

## Sidebar simplification

- Primary: Today, Projects, Write, Saved Writing  
- More: Help, Wizard, Settings  
- Project section: Overview, Sources, Plan, Write, Improve, Saved, Export  
- Advanced: collapsed section for expert tools  

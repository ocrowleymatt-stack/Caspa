# CASPA Mobile / Tablet / Desktop Manual Test Script

Use this when validating Phase 23 responsive hardening. A non-developer (James) should complete phone + iPad sections unaided.

## Phone portrait (390×844)

1. Log in at https://caspa.ocrowley.com/login
2. Tap **menu** (☰) — drawer opens; tap outside or X to close
3. Tap **Guide** in bottom bar — Guide Me drawer opens and closes
4. Open **Today** — primary buttons visible without horizontal scroll
5. **Projects** → create or open a project
6. Open **Source Library** tab — paste a note; upload works
7. **Write** (Casper) — prompt readable; Auto-write button visible
8. Run a short generation — StagedProgress visible; output link appears
9. **Saved** (bottom nav) — cards readable; open one output
10. From project **Export** — Markdown/DOCX buttons visible and tappable

**Pass if:** no clipped primary buttons, no horizontal page wobble, menu never traps you.

## Phone landscape (844×390)

1. Open **Production Wizard** (`/start`) — Back/Continue visible without scrolling the whole page
2. Open **Trash to Treasure** — paste area + submit visible
3. Open **chapter editor** — Chapters button opens rail drawer; writing area usable

**Pass if:** bottom actions not permanently off-screen; no nested scroll frustration.

## Tablet portrait (768×1024)

1. **Book Map** — chapter list scrolls; missing-chapter actions visible
2. **Chapter editor** — rail visible on large tablet or drawer on smaller; Continue/Casper reachable
3. **Gold / Swarm** (project Improve tab) — critique panels stack; Run button obvious

## Tablet landscape (1024×768)

1. **Project workbench** — tabs scroll horizontally if needed; content readable
2. **Source Library** — asset cards in single column; classify buttons reachable
3. **Output detail** — apply/export actions visible without hunting

## Desktop (1440×900+)

1. Sidebar visible; bottom mobile nav hidden
2. **Saved Writing** archive — filters + cards comfortable at wide width
3. **Export** — all package buttons in grid
4. Guide Me drawer — does not shrink main content incorrectly when AI panel closed

## iPad Safari notes

- Rotate portrait ↔ landscape on chapter editor and wizard
- Confirm keyboard does not hide the only submit button (scroll page if needed)
- Safe-area: bottom nav not under home indicator

## Fail criteria (stop ship)

- Horizontal overflow on any core page
- Primary action only on hover
- Modal taller than viewport with no scroll
- Menu/modal trap (cannot close)
- Export or Continue buttons permanently clipped

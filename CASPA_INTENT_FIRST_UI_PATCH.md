# Caspa intent-first UI patch

This patch changes the active `src/App.tsx` experience from a tool-first dashboard into an intent-first creative studio.

## What changed

- The first screen is now a Caspa Launchpad asking: **What are we making today?**
- Users can start from creative modes:
  - Novel
  - Script
  - Musical / Show
  - Adaptation
  - Gold Refinery
  - Surprise Me
- The default prompt is deliberately practical: **A Dick Turpin stage comedy set in Milton Keynes**.
- The sidebar is reorganised by user intention:
  - Make
  - Work
  - Improve
  - Produce
- Gold is repositioned as an improvement/polishing room rather than the front door.
- A clean **White Page** workspace has been added for drafting.
- A clean **Open WebUI Driver** workspace has been added.
- The Open WebUI room generates a copyable driver prompt from the current project brief and white-page canvas.
- The existing Firebase authentication wrapper remains in place.

## Product reasoning

The previous UI asked users to choose internal functions before they had chosen what they were making. The new structure starts with creative intent, then routes into the relevant workspace.

The app should now feel like:

> I want to make a novel, script, musical, adaptation, polished draft, or gloriously strange new thing.

Not:

> I must understand which pipeline stage or dashboard module to open.

## Important implementation note

The patch is currently inline-style heavy so it can be deployed quickly without adding a CSS dependency or changing the build pipeline. A later pass should split this into `CaspaLaunchpad.tsx`, `WhitePage.tsx`, `OpenWebUIDriver.tsx`, and a shared CSS/theme file.

# Caspa Studio UX Redesign Patch

Implemented a deployable Caspa Studio redesign with:

- New `src/components/CaspaRedesign.tsx` shell.
- New `src/components/CaspaRedesign.css` visual system.
- Dark literary house style: obsidian/deep slate, antique gold, ivory, mist grey, restrained violet.
- Grey Lady crest built in CSS, replacing the cartoon ghost direction.
- New desktop UX for:
  - Project Desk
  - Writing Room
  - Story Bible / Red Pen
  - Library
  - Research Desk
  - Publish
  - Settings
- Standard responsive/mobile layout; Spatial Glass Mode is bypassed so the redesign remains the default.
- Font import warning fixed by moving Cinzel into `src/index.css` and removing the late module import.

Build status:

```bash
npm run build
```

Build succeeds. Remaining warning: the existing app still has a large JS bundle because legacy components and Firebase are still statically imported by `App.tsx`. The next optimisation pass should lazy-load legacy views or remove unused modules from the active route tree.

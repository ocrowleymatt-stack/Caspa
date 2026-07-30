# Orphan components

Files here are **not mounted** by the live `src/App.tsx` intent-first shell.

## `Dashboard.music-sketch.tsx`

Legacy music-sketch / mode-card dashboard kept only as reference. Live show work goes through:

- Hero launchpad → Show in a Box (`ShowBoxStudio`)
- `ShowCommandCenter` on Next step
- `showBoxService` as shared pack state

Do not re-import this into `App.tsx` without an explicit product decision to replace the current home.

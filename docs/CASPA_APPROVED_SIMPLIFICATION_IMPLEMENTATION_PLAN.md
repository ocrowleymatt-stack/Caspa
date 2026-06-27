# CASPA Approved Simplification Implementation Plan

**Approved for automatic implementation:** Low-risk items only.  
**Baseline:** `7bd7932`

## 1. Low-risk — implement now

- Remove black quote block on Today; replace with warm bordered callout  
- Today: one primary CTA “Start with material” → Projects  
- Today: secondary cards only — Continue project, Rescue, Saved Writing  
- Collapse Today quick links grid to core four (hide Music/Documents/Command behind “More tools”)  
- Rename workbench tabs: Sources, Plan (bible), Write (manuscript), keep Improve/Saved/Export  
- Move Pier/Structure/Research/Swarm/Awards to secondary tab group only  
- Project Overview: add workflow strip Sources → Plan → Write → Improve → Export  
- Sidebar project links: Sources, Plan, Write labels  
- Rename “Secret Weapon cockpit” → “Your project”  
- Guide Me button remains on top bar  

## 2. Medium-risk — requires approval (NOT in this slice)

- New combined `/projects/:id/plan` page merging brief+bible+map  
- Remove Studio Command route  
- Default all users to simpleMode locked  
- Delete expert nav items from codebase  

## 3. Removals requiring explicit approval (NOT doing)

- Any backend module deletion  
- Storage schema changes  
- Export path removal  
- Auth changes  

## 4. Leave untouched

- Novel Write Pro strings and `/api/casper/novel-write-pro`  
- Saved Writing registry  
- Source Library API  
- Guide-state API  
- Snapshots/restore  
- Trash to Treasure  
- Intimacy settings  
- AI router  
- Critical QA scripts  

## 5. Files likely to change

- `caspa-ui/src/pages/CommandCentre.tsx`  
- `caspa-ui/src/pages/ProjectOverview.tsx`  
- `caspa-ui/src/components/workbench/ProjectWorkbenchShell.tsx`  
- `caspa-ui/src/components/Sidebar.tsx`  

## 6. Test commands

```bash
npm run build
npm run deploy
bash scripts/runtime-smoke.sh
npm run qa:critical
npm run qa:responsive
```

## 7. Rollback

```bash
git revert HEAD~N  # or reset to 7bd7932
npm run deploy && pm2 restart caspa-server
```

Rollback point before this slice: **`7bd7932`**.

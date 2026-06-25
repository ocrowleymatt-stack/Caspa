# CASPA Final Polish and QA Report

**Date:** 2026-06-23

## Polish Pass Completed

### Command Centre (Home Entry)
- Gradient hero card with active project link
- Casper online status indicator
- Quick-link grid to all Simple Mode workflows
- Getting started guide with internal links

### End-to-End Flows

1. **Natural Command:** Type intent → Interpret → Plan → Execute (workflow steps with tool routes)
2. **Casper Freestyle:** Start/continue session → parsed intent → suggested tool actions
3. **Music:** Interpret natural language prompt → start jam session with project context
4. **Document Studio:** Markdown input → HTML iframe preview (PDF via separate endpoint)
5. **Publish Confidence:** Select project → consolidated quality/smell/voice/claims check → certificate
6. **Outputs Hub:** Lists registered outputs (empty state guides user to generate artefacts)
7. **Settings:** Simple/Expert mode toggle, account, AI providers, storage (preserved)

### QA Checklist

- [x] No dead primary buttons on new pages
- [x] No TODO placeholders in shipped UI
- [x] All JSON routes return `{ success, data?, error? }`
- [x] Auth on protected routes
- [x] Stub providers clearly state unavailable
- [x] API base only in `caspa-ui/src/config.ts`
- [x] Existing routes/pages preserved
- [x] quality-core delegates — no duplicate gate logic
- [x] Zero tsc errors, both builds pass

## Known Limitations

| Area | Limitation |
|------|------------|
| Web research | `StubWebResearchProvider` — no live web search |
| Verification | Claims default to `unverified` until manually confirmed |
| Illustration | Briefs only — no image generation API connected |
| Workflow execute | Plans tool routes; does not HTTP-call each tool automatically |
| Outputs registry | Manual registration unless modules explicitly register |
| Casper CLI | Requires `CASPA_TOKEN` environment variable |
| New user registration | Pending admin approval when admin exists |

## How to Use

1. `npm install && npm run deploy && npm start`
2. Open `http://localhost:3000` → login
3. **Simple Mode:** Start at Command Centre → pick a workflow
4. **Expert Mode:** Toggle in sidebar or Settings for full elevation suite
5. **CLI:** `CASPA_TOKEN=<token> npm run casper -- "your command"`

## Safety Snapshot

Pre-consolidation tarball: `.caspa_snapshots/pre_mega_*.tar.gz`

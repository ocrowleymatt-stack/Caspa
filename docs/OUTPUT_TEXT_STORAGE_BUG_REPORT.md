# Output Text Storage Bug Report

## Problem

An output without readable body text is not a usable output. Users see **"No text stored for this output"** on detail pages and cannot apply, continue, or export.

## Canonical contract (from P0 correction)

| Field | Role |
|-------|------|
| `metadata.text` | **Required** canonical prose/report body for writing outputs |
| `metadata.content` | Mirror of `text` for compatibility |
| `metadata.hasText` | Boolean — `true` iff non-empty readable body |
| `metadata.wordCount` | Integer word count of `text` |
| `metadata.excerpt` | First ~220 chars for list cards |
| `metadata.readableSummary` | For structured-only outputs (structure report, bible JSON) |
| Other keys | Structured data in metadata — **not instead of** text |

## Extraction fallback order

When normalising or repairing, search metadata in order:

1. `text`
2. `content`
3. `revisedText`
4. `finalText` / `finalProse`
5. `improvedRewrite` / `rewrite`
6. `firstDraft`
7. `output` / `result` / `draft` (string only)
8. `report` (string)
9. Kind-specific builders (consensus summary, revision plan join, structure unit summary)

## Generators audited

| Generator | Issue | Fix |
|-----------|-------|-----|
| Novel Write Pro | Has `text` + `firstDraft` | Normalise at register |
| Continue Writing | Has `text` | OK |
| Gold Pass | `text` may be revision plan only | Ensure improved prose or labelled plan |
| Agent Swarm | Report mode: no `text` | Add consensus summary as `text` |
| Structure analyse | No prose | Add `readableSummary` |
| Project Bible | Nested object | Add premise/structure summary as `text` |
| Book Map | Map fields | Add finish roadmap summary as `text` |
| Research passes | JSON | Add verdict/report string as `text` |
| Export package | Paths only | `hasText: false`, `outputKind: archive` |

## API requirements

- `GET /api/outputs` — include `hasText`, `excerpt`, `wordCount` on each item (computed if missing)
- `GET /api/outputs/:id` — full record with normalised `metadata.text`
- `POST /api/outputs` — reject successful **writing** types with empty text (allow structured/archive kinds)

## Repair

Script: `scripts/repair-empty-outputs.ts`

```bash
npm run repair:outputs -- --dry-run
npm run repair:outputs
```

Rules: extract from metadata fallbacks; never invent text; never overwrite non-empty `text`.

## UI rules

- Hide Apply / Continue / Export when `hasText === false` (except Open / Rerun / Repair hint)
- Show diagnostic: "This output has no stored text — it may be a structure report or a legacy record."

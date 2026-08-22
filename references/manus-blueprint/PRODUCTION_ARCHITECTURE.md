# CASPA Book Production Architecture

## Product promise

CASPA carries an approved manuscript through visual direction, cover and illustration decisions, deterministic page composition, proof review, and production packages without taking an irreversible creative action. AI proposes; the author approves. Every brief, asset, layout, proof, and package is versioned and owner-scoped.

## Extended canonical workflow

`draft → diagnosed → plan-approved → revision-running → review → export-ready → art-direction → art-approved → layout → proof-review → production-ready → archived`

**Export ready** continues to mean the manuscript has passed editorial preflight. It is the entry point to production rather than the end of the overall project. **Art direction** contains the suitability decision and author-approved visual brief. **Art approved** means a cover is approved and every required illustration is approved or explicitly waived. **Layout** creates an immutable page-plan version. **Proof review** resolves author annotations against a specific layout version. **Production ready** requires a passing server preflight and explicit proof approval.

## Illustration suitability policy

| Project type | Default | Production behavior |
| --- | --- | --- |
| Picture book | Required | Propose one image per spread or narrative beat, with strict character and palette continuity. |
| Poetry | Optional | Suggest section openers or restrained full-page plates only when imagery supports the collection’s structure. |
| Fiction | Optional, sparse | Recommend chapter openers or a limited plate program; never illustrate every scene by default. |
| Non-fiction | Conditional | Recommend diagrams, maps, figures, or documentary illustrations only when they explain content or reduce cognitive load. |
| Essay | Usually none | Prefer typographic and cover-led production unless the manuscript has explicit visual evidence. |
| Script | Usually none | Treat the script as a professional text document unless the author requests a pitch-book edition. |
| Polish | Inherit | Preserve the source project’s visual program or ask the author to choose. |

The suitability result is always advisory and includes a rationale. The author can choose **none**, **cover only**, **limited illustrations**, or **fully illustrated** before any images are generated.

## Approval boundaries

CASPA cannot generate production layout until one cover concept is approved and all planned illustration slots are approved, waived, or removed. Regeneration creates a new immutable asset record. Uploaded artwork follows the same approval path. A proof cannot become production-ready while an annotation is open or while any asset referenced by the layout is missing.

## Layout defaults

| Format | Default trim | Interior direction |
| --- | --- | --- |
| Fiction / Essay / Poetry | 6 × 9 in | Restrained serif text, generous chapter openings, running heads, folios, paragraph rhythm tuned by format. |
| Non-fiction | 7 × 10 in | Strong hierarchy, figure captions, accessible tables, stable cross-reference labels. |
| Picture book | 10 × 8 in landscape | Full-bleed spread composition, image-safe text zones, sparse copy, spread-level pacing. |
| Script | 8.5 × 11 in | Industry-style monospaced screenplay composition with fixed scene and dialogue rules. |
| Polish | 6 × 9 in | Inherit manuscript structure and author-selected style. |

Authors can override trim, margins, typography direction, running heads, folios, chapter opening behavior, paragraph treatment, bleed, and image placement before generating a layout version.

## Production packages

The production engine emits an interior PDF, an exact-title cover PDF, an EPUB package, approved image assets, and a JSON manifest containing version IDs, checksums, trim, bleed, metadata, and preflight results. Generated concept art remains separate from exact production typography: CASPA composes title and author text deterministically over an approved cover image so print metadata stays accurate.

## Error and privacy contract

Image and language providers run only on the server. Author-facing errors contain a stable code, recovery guidance, and trace ID. Provider messages, internal prompts, model names, storage keys, environment values, and renderer diagnostics remain server-only.

## Open-source production foundations

CASPA’s deterministic output engine uses [PDFKit](https://github.com/foliojs/pdfkit) for Node-based PDF composition and [JSZip](https://github.com/Stuk/jszip) for standards-based EPUB and production-package assembly. Generated image derivatives use [Sharp](https://github.com/lovell/sharp) to normalize cover and illustration assets into 300-DPI, print-resolution PNGs before preflight. The repositories were checked on 22 August 2026: PDFKit had approximately 10.7k GitHub stars and an update on 20 August 2026; JSZip had approximately 10.4k stars and an update on 28 March 2025; Sharp had approximately 32.6k stars and an update on 20 August 2026. A smaller `epub-gen` candidate was reviewed but not adopted because CASPA needs explicit control over immutable assets, EPUB package structure, manifests, accessibility metadata, and checksums.

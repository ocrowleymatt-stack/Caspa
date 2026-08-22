# CASPA Functional Parity and Improvement Audit

## Basis and scope

This audit compares the rebuilt application with the current CASPA product inspected locally from its selected repository because the live deployment is protected by SSO. The comparison is grounded in the retained [live product inspection](../caspa_review/live_inspection_notes.md) and [architecture audit](../caspa_review/architecture_audit.md). It evaluates **author-facing capability**, **server-side workflow integrity**, and **failure/recovery behavior**, rather than attempting a pixel-for-pixel replication.

> **Parity standard.** The rebuilt CASPA must preserve the current product’s valuable manuscript workflow—guided drafting, diagnosis, controlled revision, resumable work, and export—while replacing ambiguity, scope creep, client-side gates, and raw operational failures with explicit author approval and server-enforced policy.

## Capability comparison

| Capability | Current CASPA observation | Rebuilt CASPA implementation | Result |
| --- | --- | --- | --- |
| Project entry | The “What are we making?” launchpad is strong, but immediately exposes a dense and unrelated tool inventory. | The launchpad collects format, premise, metadata, and target length, then its primary action opens `Draft with CASPA` directly. Project cards also label the draft-stage next action. | **Exceeds**: one clear entry and no unrelated modules. |
| Auto-writing | “Just write” offers a staged drafting route, but repeats controls across multiple navigation systems and surfaced raw infrastructure errors on failure. | `Draft with CASPA` provides opening, append, and replace-chapter modes; premise, outline, voice, exclusions, scope, target length; a private preview; reject/regenerate/copy paths; and an explicit acceptance checkbox. | **Exceeds**: the writer sees one purpose-built flow with no silent mutation. |
| Manuscript continuity | Current drafting prompts are coupled to broad product services and offer no independent, visible continuity decision. | Drafts are grounded in the active version and chapter context. An independent server-side continuity review evaluates premise, exclusions, and established source facts before storage. Stale previews cannot be accepted. | **Exceeds**: continuity is a non-bypassable server policy. |
| Author control | The current workflow suggests consequential one-click transformations such as “Accept plan & finish book.” | Every draft, revision plan, revision result, art program, proof, and export is approval-gated; an accepted draft creates a new named version rather than replacing history. | **Exceeds**: decisions are explicit, reversible, and auditable. |
| Diagnosis | Current Workshop provides a valuable fallback plan when an AI call fails, but mixes assessment and execution, reports opaque viability scores, and can overreach from short excerpts. | Diagnosis returns rubric-backed findings with evidence, category, severity, confidence, rationale, and a selected-fix plan. AI failure falls back deterministically without exposing provider diagnostics. | **Matches / exceeds**: fallback retained; explanation and scope control improved. |
| Revision orchestration | Current server-owned commission work supports checkpoints and restart recovery, a capability worth retaining. Its completion status can conflate warnings and failures. | Revision jobs are server-owned, resumable, project-scoped, and chapter-checkpointed with explicit `queued`, `running`, `awaiting-review`, `succeeded`, `succeeded-with-warnings`, and `failed` states plus retry behavior. | **Exceeds**: retained resilience with unambiguous completion semantics. |
| Versions and recovery | Current work is distributed through browser storage and server snapshots, making cross-device recovery difficult. | Manuscript saves, diagnoses, accepted drafts, revisions, layouts, and proofs create immutable database-backed versions with comparison and guarded restore. | **Exceeds**: version integrity is transactional and user-scoped. |
| Export integrity | Current export readiness can be calculated client-side and can clear short or structurally incomplete content. | Manuscript export and book-production packages are locked behind current server-side preflights. Checks are project-type-specific and include content, metadata, layout, cover, assets, proof, and accessibility requirements. | **Exceeds**: no client override can label incomplete work ready. |
| Book production | The current product exposes publishing profiles but does not provide a coherent approval chain from manuscript to art and layout. | CASPA now orchestrates art direction, print-normalized cover concepts, optional illustration plans with continuity controls, deterministic layout, proof comments, preflight, PDF, EPUB, and source packages. | **Exceeds**: complete author-approved production workflow. |
| Trust and scope | Legal cases, betting, infrastructure diagnostics, and inconsistent brand language compete with the writing product. | The rebuilt product confines the experience to manuscript and book production. Settings contain only account, backup, export, and guarded deletion controls. | **Exceeds**: a focused, credible authoring boundary. |
| Privacy, ownership, and failures | Current architecture uses mixed auth/local scopes and can expose raw upstream diagnostics in the client. | Protected procedures enforce ownership for projects, versions, jobs, previews, art assets, layouts, proofs, and exports. Stable recovery codes and trace IDs replace raw provider or infrastructure errors. | **Exceeds**: uniform server trust boundary. |

## Draft with CASPA acceptance criteria

The upgraded auto-write feature is treated as a **capability**, not an ornamental screen. The following conditions are required and are covered by the implementation and verification run.

| Criterion | Enforcement |
| --- | --- |
| Available only before diagnosis | The canonical workflow exposes `draft-manuscript` only in `draft`; later manuscript history is not an auto-write target. |
| Grounded in the manuscript | The service derives opening, append, or replacement context from the active version and selected chapter. |
| Safe generation contract | The service parses structured generation output, normalizes supported authoring variants, bounds word count, and requires an independent continuity verdict before persistence. |
| No automatic mutation | Previews live in a separate `draftPreviews` record. Reject and regenerate leave the active manuscript version unchanged. |
| Explicit acceptance | The client must send `authorConfirmed: true`; server logic rejects stale, rejected, or already-handled previews. |
| Immutable accepted result | An accepted preview becomes an `auto-draft` manuscript version with source-version lineage and recalculated metrics. |
| Useful handoff | The accepted version becomes the active manuscript and can immediately enter evidence-backed Workshop diagnosis. |

## Verification evidence

The completed test suite contains **48 passing assertions across 11 test files**. It covers canonical state restrictions, draft response normalization, continuity gate rejection, real persisted draft-preview ownership and lifecycle transitions, stale/accepted/rejected preview conditions, anonymous procedure protection, stable error payloads, revision checkpoints, export preflight, production ownership, and proof integrity. The disposable real-database integration suite verified that no temporary projects or users remained after cleanup.

The protected Draft with CASPA verification script additionally exercised the live server-side drafting path: it rejected an initial preview without changing the active version, accepted a regenerated preview as an `auto-draft` version, created a grounded next-chapter preview, and handed the accepted manuscript into Workshop diagnosis. The existing production verifier continues to cover art direction through archived production output. Desktop and mobile review confirm that the drafting controls, preview, and acceptance gate remain reachable and readable.

## Concrete parity evidence matrix

The matrix uses **Passed** only where both a current-product observation and rebuilt behavior are directly evidenced. **Partial** means the rebuilt behavior is validated but the comparison necessarily includes qualitative judgment. **Not directly comparable** means no defensible like-for-like current output exists, and it is intentionally not presented as a parity win.

| Dimension | Inspected current-site evidence | Rebuilt evidence | Validation method | Evidence status |
| --- | --- | --- | --- | --- |
| Discoverable drafting | “Just write” repeats controls across page, stage rail, and fixed workflow bar. | One named `Draft with CASPA` route appears on the launchpad and draft-stage workspace. | Desktop/mobile launchpad captures and direct `?view=draft` handoff. | **Passed — clearer direct entry** |
| Author approval | The current workflow uses consequential “finish book” language before durable work begins. | Preview is separate from the active manuscript; acceptance is explicit and reject/regenerate do not mutate the active version. | Real-database lifecycle integration suite and protected end-to-end verifier. | **Passed — stronger approval control** |
| Draft continuity | The current prompt layer is coupled and does not expose an independent continuity decision. | Version/chapter grounding, source freshness, structured normalization, and an independent continuity verdict are required before storage. | Policy suite and live protected generation. | **Passed — measurable continuity safety** |
| Chapter prose quality | The inspected product can generate draft material but has no reproducible quality benchmark. | CASPA uses author briefs, target bounds, and an author preview. | Live generation created accepted and grounded next-chapter previews. | **Not directly comparable — author judgment required** |
| Resumable revision | Current commission work has checkpoints but can overload completion semantics. Equivalent isolated execution is blocked by the incumbent’s exhausted shared provider pool. | Revision jobs expose checkpointed, project-scoped, warning-aware status. | Job/checkpoint tests and recorded end-to-end revision workflow; incumbent blocker documented in `INCUMBENT_AUTO_WRITE_COMPARISON.md`. | **Blocked incumbent execution — rebuild verified separately** |
| Recovery and errors | Provider and infrastructure details can reach current-product users. | Errors expose only stable recovery codes, author messages, and trace IDs. | Safety tests, real protected cross-user rejection, and model-response fault path. | **Passed — safer recovery boundary** |
| Version integrity | Current work is split between browser storage and mixed snapshots. | Accepted drafts, diagnoses, revisions, layouts, and proofs are immutable and user-owned. | Real persistence test plus desktop/mobile Version History capture. | **Passed — immutable lineage evidenced** |
| Export and production | Current export cleared a 242-word manuscript despite a restructure recommendation and contradictory blocked status elsewhere. | Server preflights control manuscript and production packages. | Current inspection observation plus export/production tests and production end-to-end workflow. | **Partial — current defect observed; rebuild gate verified separately** |
| Product focus | Unrelated legal and betting modules coexist with authoring. | Rebuild confines author-facing scope to manuscript development and book production. | Route and UI review. | **Passed — focused scope** |
| Ownership boundary | Current architecture has mixed local/auth scope and inconsistent route protection. | Protected procedures scope projects, versions, previews, jobs, art, layouts, proofs, and exports to an owner. | Real persisted cross-user preview denial and cleanup query. | **Passed — ownership boundary evidenced** |
| Visual quality | The live product has mismatched authentication/application visual systems and crowded workflow navigation. | The rebuild uses one dark literary system across all reviewed author flows. | Desktop/mobile screenshot review of launchpad, drafting, versions, and production. | **Partial — qualitative comparison** |

The matrix deliberately distinguishes measured behavior from subjective literary quality. CASPA can prove **continuity, approval, persistence, state, and recovery** constraints; it must still leave prose judgment to the author rather than claiming a model has universally better writing quality. Therefore, CASPA can accurately claim functional parity or improvement for directly measured workflow dimensions, while prose quality and visual preference remain explicitly author-reviewed.

The equivalent incumbent scenario is recorded separately in [INCUMBENT_AUTO_WRITE_COMPARISON.md](./INCUMBENT_AUTO_WRITE_COMPARISON.md). It demonstrates direct operational improvement for the same opening-draft request because the incumbent returned no prose and exposed internal recovery details, whereas the rebuilt workflow completed its author-gated versioned draft. It does not change the `Not directly comparable` prose-quality status.

## Residual operational limits

The rebuild deliberately keeps an author in control; it does not promise that one model call produces publication-quality prose. A withheld preview is treated as a safe recovery state, not an automatic fallback mutation. Long-form quality remains subject to author review, the same way proof approval remains required before production output.

The project’s production build currently reports a large client chunk warning. This does not change functional parity or safety, but route-level lazy loading of heavier production tools remains a sensible performance follow-up.

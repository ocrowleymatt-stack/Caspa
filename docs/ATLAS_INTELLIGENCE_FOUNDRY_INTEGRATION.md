# ATLAS Intelligence Foundry — shared brain and interface contract

## Authority and integration
ATLAS is the headless reasoning, knowledge and tool service. It is **not** a replacement for existing services. Preserve existing Nexus/AtlasRouter provider routing, CASPA literary code, ATLAS Chamber Android app and its branch `experiment/app-chamber-probe`. CASPA is one client of the Foundry, not the Foundry itself.

Clients: LibreChat, private ChatGPT plugin (when securely deployed), ATLAS Chamber Android, existing ATLAS web applications. Use one authenticated API with user and project-scoped permissions, immutable evidence provenance, auditable operations and independent verification. Never send another user's private project data to a client or model.

## Core task envelope (version 1)
Request: `{requestId, userId, projectId, client, mode, task, input, sourceRefs?, consent?, idempotencyKey?}`.
Modes: `examine | wildcard | synthesis | invent | challenge`.
Tasks: `research | reason | verify | discover | remember | caspa | chamber | live-call`.
Response: `{requestId, status, claims[], evidence[], hypotheses[], uncertainties[], toolRuns[], artefacts[], nextActions[], auditRef}`.
All claims carry source IDs, temporal/jurisdiction scope where applicable, and status `verified | supported | disputed | unverified | refuted`. Verification requires actual source/tool checks, not model confidence.

## ATLAS Chamber — preserve existing project
Android AUTO-first assistant with Odysseus AI/Wraith, Live Call Adviser and App Operator. Keep accessibility screen inspection, labelled taps, text entry, stop controls, operator logs, editable reply composer and approval-based sending. Maintain a clear boundary between proposed actions and executed actions. Do not assert end-to-end Android control until tested on device.

## Live Call Adviser
During an active call, where device capabilities, permissions and applicable recording/consent requirements permit:
1. Accept authorised live transcript segments or manual notes with timestamps and speaker uncertainty.
2. Identify questions asked, commitments, reference numbers, deadlines, contradictions and missing information.
3. Offer short real-time suggested responses and relevant source-backed facts to the user, never automatically speak or send.
4. Maintain a rolling timeline, post-call summary and action list, with links to original transcript spans.
5. Provide a one-tap pause/stop and immediate delete option for captured material.
6. Avoid covert recording or falsely claiming microphone/call access. If the device/OS cannot capture the call, support manual notes and permitted external transcription.
7. Require explicit user approval for any outbound message, app action, filing or manuscript change.

## Examiner + Wildcard
The Examiner tests propositions and records reproducible evidence. Wildcard generates unconventional, potentially patentable hypotheses, analogies and experiments. Wildcard hypotheses must be marked as such; novelty searches are not patentability guarantees. The synthesis pipeline converts proposals into testable claims and never upgrades an idea to a fact without verification.

## CASPA constraints
Conversation defaults to exploration; `/story` generates independent story candidates; `/draft` generates manuscript candidates; `/stitch` proposes insertions; `/approve <id>` is required for canonical changes. Store originals immutably, enforce per-user ownership and maintain project-level collaboration ACLs.

## Acceptance criteria
- Identical task envelope works through LibreChat, ATLAS Chamber and a private plugin test client.
- A user cannot access another user's notes, transcripts or manuscripts.
- Live-call suggestions work from timestamped sample transcript segments, without automatically sending or recording.
- An operator action requires user confirmation and has a tested stop mechanism.
- An invented claim remains unverified; a source-backed claim can be independently traced.
- CASPA story-to-draft-to-approval workflow does not mutate the source before approval.
- Existing LLM, routing and applications continue operating; no new resident GPU-dependent models.

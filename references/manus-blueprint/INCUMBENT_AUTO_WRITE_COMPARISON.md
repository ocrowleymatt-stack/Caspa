# Equivalent Auto-Write Scenario: Incumbent vs Rebuild

## Shared scenario

Both paths were evaluated with the same representative opening request: **novel** mode, the premise of an archivist following an erased civic record through a city that quietly removes its history, a **quiet literary suspense** tone, an opening titled **“The Missing Shelf,”** no prior source text, and a **300-word** target.

| Dimension | Incumbent local build | Rebuilt CASPA | Direct result |
| --- | --- | --- | --- |
| Invocation | `POST /api/caspa/write/auto-write` on the isolated local incumbent server. | Protected `Draft with CASPA` preview procedure using the same premise and target. | Equivalent opening-draft intent exercised. |
| Output | Returned HTTP **500**; no chapter draft was available. | Produced a 301-word accepted `auto-draft` version and a grounded next-chapter preview. | **Rebuild completed; incumbent did not.** |
| Recovery payload | Included the internal “Atlas model pool exhausted” message, an Ollama availability detail, an OpenAI HTTP error, and a masked credential fragment. | Returns a stable recovery code, author-oriented message, and trace ID only; raw upstream output remains server-only. | **Rebuild has a stronger trust boundary.** |
| Continuity gate | No output was available for review; the route directly delegates to its provider chain and returns the upstream failure message. | Opening/append/replace grounding is derived from the active version, then an independent server continuity review runs before preview persistence. | **Rebuild has a directly evidenced continuity policy.** |
| Mutation control | The route updates an in-memory job registry but does not provide an author acceptance/versioning checkpoint for the tested call. | Reject is non-mutating; acceptance creates one immutable, source-linked version; stale preview acceptance is refused. | **Rebuild has directly evidenced version safety.** |
| Prose quality | Not evaluable because the equivalent call failed before producing text. | A generated sample was accepted through author-gated workflow, but no objective superiority claim is made. | **Not directly comparable; author review remains decisive.** |

## Evidence handling

The incumbent response was captured only long enough to establish the HTTP status and recovery behavior. It contained a masked credential fragment, so the raw response is intentionally not retained in the project deliverable. The documented result above preserves the security-relevant fact without reproducing the secret-like material.

## Conclusion

For this same scenario, the rebuild **exceeded the incumbent in directly measurable operational behavior**: availability, output completion, grounded continuity safeguards, author approval, version preservation, and error sanitization. The comparison does not assert that one model writes universally better prose; the incumbent produced no comparable text, and literary quality properly remains subject to author review.

## Revision and export comparison bounds

An equivalent incumbent **revision/resume** run could not be executed in the isolated local build because its shared AI provider pool was already exhausted for the direct auto-write request. The incumbent revision paths use the same server-side provider chain, so a retry would test the same configuration failure rather than revision behavior. The retained inspection also observed that the incumbent exposed this provider state and masked credential material to the author. The rebuilt revision workflow has separately verified checkpoint, retry, warning, ownership, and state behavior; this is recorded as **rebuilt verified / incumbent execution blocked**, not a direct side-by-side benchmark.

The incumbent **export** behavior was directly observed during inspection: a 242-word fiction manuscript with 65% viability and a restructuring recommendation was nonetheless marked “Cleared for export” with PDF download enabled, while another current screen reported export blocked. The rebuild’s server preflight is independently verified for word count, manuscript structure, metadata, asset requirements, proof approval, and non-bypassable download gating. This is a direct contrast of observed integrity behavior, but not a like-for-like binary-artifact benchmark, so the parity audit keeps export comparison status evidence-bounded.

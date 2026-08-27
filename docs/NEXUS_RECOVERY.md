# Caspa → Nexus recovery fabric

Caspa uses the co-resident Nexus recovery service for operational failure classification and bounded same-operation retry decisions.

Default endpoint:

`http://127.0.0.1:43101/internal/recovery/incidents`

The Nexus endpoint is loopback-only and is not exposed through the Atlas nginx `/v12/` surface.

## Router behaviour

The canonical Caspa provider router wraps unified, local Ollama and cloud completion attempts with `callWithNexusRecovery`.

- the first failure is reported to Nexus;
- Nexus classifies the error using the same immune-system rules as Atlas;
- a same-provider retry happens at most once, and only when the operation is marked safe/idempotent and Nexus returns `retryable: true`;
- persistent failure returns to Caspa's existing provider circuit-breaker and fallback chain;
- billing, invalid input, permissions and other non-retryable conditions are not blindly repeated;
- Nexus recovery unavailability never becomes a second Caspa outage.

This is the first cross-service consumer of the Nexus recovery fabric. New co-resident Atlas services should use the same incident contract rather than inventing independent retry policy.

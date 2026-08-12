# Atlas Router

Atlas-owned cloud model routing service. It is intentionally independent of the Caspa application runtime.

## Runtime boundary

- Service identity: `AtlasRouter`
- Internal bind: `172.19.0.1:3014`
- Consumer: `atlas-openwebui`
- Public exposure: none required
- Local model fallback: owned by OpenWebUI, not this service
- Caspa runtime dependency: none

## Source boundary

Everything required to build the router is contained under `atlas-router/`. The directory can be moved to a standalone Atlas repository without importing Caspa application source.

Provider credentials live on the host in `/root/.atlas-secrets/atlas-router.env`; never commit them.

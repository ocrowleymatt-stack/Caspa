# Casper Freestyle Terminal

Natural language command interface for CASPA Studio.

## Quick Start

```bash
# 1. Login and copy token
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@caspa.local","password":"changeme"}'

# 2. Run Casper
export CASPA_TOKEN="<token from login>"
npm run casper -- "check quality and prepare for publishing"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CASPA_API_URL` | `http://localhost:3000` | API base URL |
| `CASPA_TOKEN` | — | Bearer token (required for authenticated API) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/casper/freestyle` | Send input or start session |
| POST | `/api/casper/freestyle/stream` | SSE stream response |
| GET | `/api/casper/sessions` | List sessions |
| GET | `/api/casper/session/:id` | Get session |
| POST | `/api/casper/session/:id/continue` | Continue session |
| GET | `/api/casper/tools` | List routable tools |
| GET | `/api/casper/status` | Engine status |

## Example Session

```bash
# Start with input
curl -X POST http://localhost:3000/api/casper/freestyle \
  -H "Authorization: Bearer $CASPA_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"input":"help me with music for chapter three"}'

# Continue session
curl -X POST http://localhost:3000/api/casper/session/SESSION_ID/continue \
  -H "Authorization: Bearer $CASPA_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"input":"make it a slow ballad"}'
```

See `docs/CASPER_FREESTYLE_OPENAPI.json` for OpenAPI spec.

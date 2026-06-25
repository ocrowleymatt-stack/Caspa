# CASPA Studio — Authentication & Multi-User

**Last updated:** 2026-06-23

CASPA Studio supports password-protected multi-user access with admin approval for new registrations. Each user owns their projects; admins can manage users and see all projects.

---

## Quick start

1. Copy `.env.example` to `.env` and set secure values:

```bash
AUTH_SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=admin@caspa.local
ADMIN_PASSWORD=your-secure-password
JWT_EXPIRES_IN=604800
```

2. Start the server. On first run with an empty `data/users.json`, a bootstrap admin is created from `ADMIN_EMAIL` + `ADMIN_PASSWORD`.

3. Sign in at `/login` with the admin credentials.

4. New users register at `/register` — they remain **pending** until an admin approves them at **Admin → User Management** (`/admin/users`).

---

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `AUTH_SECRET` | Yes (prod) | `change-me-in-production` | HMAC secret for JWT signing |
| `JWT_EXPIRES_IN` | No | `604800` (7 days) | Session lifetime in seconds |
| `ADMIN_EMAIL` | Bootstrap | — | First admin email when no users exist |
| `ADMIN_PASSWORD` | Bootstrap | — | First admin password when no users exist |

---

## Auth model

### Users (`data/users.json`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | nanoid |
| `email` | string | Unique, lowercased |
| `passwordHash` | string | bcrypt (cost 12) |
| `displayName` | string | Display name |
| `role` | `admin` \| `user` | Role |
| `status` | `pending` \| `active` \| `rejected` \| `disabled` | Account state |
| `createdAt` | ISO string | Created timestamp |
| `updatedAt` | ISO string | Last update |
| `verifiedAt` | ISO string? | When admin approved/rejected |
| `verifiedBy` | string? | Admin user id |

### Sessions (`data/sessions.json`)

JWT bearer tokens reference a server-side session record. Logout deletes the session, invalidating the token immediately.

### Project scoping

Projects have an optional `ownerId`. Users see only their own projects; admins see all. Existing projects without `ownerId` are assigned to the bootstrap admin on startup.

---

## API authentication

**Scheme:** Bearer token in `Authorization` header.

```
Authorization: Bearer <jwt-token>
```

All `/api/*` routes require auth except:

- `POST /api/auth/register`
- `POST /api/auth/login`

Public non-API route: `GET /health`

All responses use `{ success, data?, error? }`.

### Auth routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public | Create pending user |
| POST | `/api/auth/login` | Public | Login → `{ token, user }` |
| POST | `/api/auth/logout` | User | Invalidate session |
| GET | `/api/auth/me` | User | Current user profile |
| GET | `/api/auth/users` | Admin | List all users |
| GET | `/api/auth/users/pending` | Admin | List pending users |
| POST | `/api/auth/users/:id/approve` | Admin | Activate user |
| POST | `/api/auth/users/:id/reject` | Admin | Reject registration |
| POST | `/api/auth/users/:id/disable` | Admin | Disable active user |
| POST | `/api/auth/users/:id/promote` | Admin | Promote to admin |

---

## Admin workflow

1. **First admin:** Created automatically on startup from env vars when `data/users.json` is empty.
2. **New registration:** User submits `/register` → status `pending`.
3. **Approval:** Admin opens `/admin/users`, approves or rejects from the pending queue.
4. **Ongoing:** Admin can disable users or promote them to admin from the all-users table.

---

## UI flow

| Route | Access | Purpose |
|-------|--------|---------|
| `/login` | Public | Sign in |
| `/register` | Public | Request account |
| `/admin/users` | Admin only | User management |
| All other routes | Authenticated | Wrapped in `AuthGuard` |

The sidebar shows the signed-in user's email and a logout button. Admins see a **User Management** link.

Auth token and user profile are persisted in `localStorage` via Zustand (`caspa-ui` key). All API calls attach `Authorization: Bearer …` automatically.

---

## Backend module layout

```
src/modules/auth/
├── AuthService.ts      # register, login, logout, validateSession, hash/verify
├── UserService.ts      # CRUD, approve, reject, disable, bootstrap
├── authMiddleware.ts   # requireAuth, requireAdmin
├── auth-routes.ts      # /api/auth/* routes
├── projectAccess.ts    # Project ownership helpers
├── types.ts
├── errors.ts
└── index.ts            # exports authRouter, authMiddleware, bootstrapAuth
```

`server.ts` mounts `authRouter` before `requireAuth` middleware, which protects all subsequent module routers.

---

## Creating the first admin

**Option A — Environment bootstrap (recommended):**

Set in `.env` before first start:

```
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=SecurePassword123!
AUTH_SECRET=<random-32-byte-hex>
```

Delete `data/users.json` if it exists, then restart. The admin is created with `status: active`.

**Option B — Manual seed:**

If env vars are not set and no users exist, registration remains open. The first registered user would still be pending unless you manually edit `data/users.json` or set env vars and restart.

---

## Security notes

- Change `AUTH_SECRET` and `ADMIN_PASSWORD` before any production deployment.
- Pending users cannot log in until approved.
- Disabled and rejected users receive explicit error messages on login.
- Sessions are stored server-side; logout is immediate.
- Passwords are never stored in plain text.

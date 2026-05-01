# Security Specification

## Data Invariants
1. Access controls: A Project's `ownerId` must strictly equal `request.auth.uid`. Collaborators must be checked natively if implemented. For now, strict ownership implies `ownerId == request.auth.uid`.
2. User profile records (`/users/{userId}`) are strictly isolated. A user can only access and modify their own PII.
3. All subcollections (`chapters`, `characters`, `plotNodes`, etc.) inherit access from `projects`.
4. Every `updatedAt` update must match `request.time`.
5. Schema fields are strictly validated based on `firebase-blueprint.json`.
6. Only verified emails are allowed write/read access.

## The "Dirty Dozen" Payloads
1. **Schema Poisoning:** Injecting unknown keys during creation.
2. **Type Forgery:** Passing a number instead of a string array.
3. **Ghost Field:** Updating with an invalid `isAdmin` field.
4. **Owner ID Change:** A user updates `ownerId` to another UID.
5. **Timestamp Tampering:** Updating `updatedAt` to a client-controlled timestamp instead of `request.time`.
6. **ID Injection:** Providing a project ID with massive junk characters.
7. **Nested Object Exploitation:** Bypassing map checks by pushing unvalidated map schemas.
8. **Subcollection Orphan Attack:** Creating a subcollection document without ensuring the parent `Project` exists and belongs to them.
9. **Blanket Querying:** Reading a project list without filtering for `ownerId`.
10. **Array Explosion:** Adding over 50 collaborators to the array.
11. **Spoofed Admin:** Sending `admin` claims directly.
12. **PII Blanket Attack:** Trying to pull auth info via presence queries.

## Test Runner Definition
Defined in `firestore.rules.test.ts` (coming soon).

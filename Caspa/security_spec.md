# Security Specification - NovelWrite Pro

## Data Invariants
1. A project must have a valid `ownerId` matching the creator's UID.
2. Sub-resources (Characters, chapters, etc.) must belong to a project that the user has access to (owner or collaborator).
3. Public projects allow read-only access to their chapters via `get` and `list` operations even for unauthenticated users, if the project has `isPublic: true`.
4. Users can only update their own presence status.
5. Critical project fields like `ownerId` and `createdAt` are immutable after creation.
6. `updatedAt` field must be validated against `request.time` where applicable.

## The "Dirty Dozen" Payloads
1. **Identity Spoofing**: Attempt to create a project with `ownerId` set to a different user's UID.
2. **Privilege Escalation**: Attempt to add oneself to a project's `collaborators` list without being the owner.
3. **Orphaned Writes**: Attempt to add a chapter to a non-existent `projectId` or a project the user doesn't own.
4. **Shadow Updates**: Attempt to update a project with extra fields (e.g., `isAdmin: true`).
5. **PII Leak**: Attempt to read private project data of another user.
6. **Presence Hijacking**: Attempt to update another user's presence document.
7. **Bypass Public Lock**: Attempt to write to a project's chapters when only public read is allowed.
8. **Resource Exhaustion**: Attempt to create a document ID with 1MB of garbage data.
9. **Timestamp Manipulation**: Attempt to set a past or future `updatedAt` date.
10. **Terminal State Bypass**: (If any terminal states exist, e.g., project archived) - Attempt to update an archived project.
11. **Collaborator Hijacking**: Collaborator trying to delete the project they don't own.
12. **Type Confusion**: Sending a string for a boolean field (e.g., `isPublic: "true"`).

## Test Runner (Simplified for rule drafting)
The tests will verify that:
- `projects/{projectId}` create/update/delete strictly check `ownerId`.
- Sub-collections check parent project membership.
- Public read works for `isPublic` projects.
- Immutable fields are enforced.

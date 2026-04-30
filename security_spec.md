# Security Specification for NovelWrite Pro

## Data Invariants
1. A **Project** must have an `ownerId`. Only the owner can delete a project.
2. **Collaborators** must be listed in a project's `collaborators` array to read or write project sub-resources.
3. **Chapters**, **Characters**, **PlotNodes**, and **ResearchNotes** must belong to a valid Project.
4. **Comments** are linked to a specific Chapter.
5. **Presence** is user-specific and strictly tied to a user's ID.
6. Immutable fields like `createdAt` and `ownerId` must never change after creation.

## The "Dirty Dozen" Payloads (Anti-Tests)
1. **Identity Theft**: Creating a project with someone else's `ownerId`.
2. **Ghost Project Read**: Reading project data without being a collaborator or owner.
3. **Privilege Escalation**: Adding myself to the `collaborators` list of a project I don't own.
4. **Shadow Field Injection**: Adding `isVerified: true` to a character profile to gain system-level trust.
5. **ID Poisoning**: Using a 2KB string as a `nodeId`.
6. **Time Warp**: Setting `updatedAt` to the future or the past (client-provided).
7. **Relational Breakage**: Creating a Chapter for a Project that doesn't exist.
8. **Presence Spoofing**: Updating `presence/{otherUserId}` data.
9. **Recursive Cost Attack**: Requesting a list of projects with a query that ignores the `ownerId` or `collaborators` filter.
10. **Terminal Lock Bypass**: Modifying a plot node marked as "resolved".
11. **PII Leak**: Reading another user's email from their private profile (split collection).
12. **Comment Bombing**: Adding comments at a negative position or with massive text payloads.

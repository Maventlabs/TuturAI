# Firestore Model Audit

## Current Collections

### `users/{uid}`

- `id`: Firebase Auth UID.
- `email`, `displayName`, `school`: profile fields.
- `role`: immutable `student` or `teacher`.
- `className`, `subject`: nullable onboarding fields.
- `xp`, `level`: numeric progress fields.
- `createdAt`, `updatedAt`: Firestore timestamps.

### `classrooms/{classroomId}`

- `name`, `description`, `school`: classroom metadata.
- `teacherId`: owning teacher UID.
- `status`: `active` or `archived`.
- `joinKeyHash`: SHA-256 hash of the 8-character join key.
- `joinKeyRevoked`: whether joining is disabled.
- `createdAt`, `updatedAt`: Firestore timestamps.

### `classMemberships/{classroomId}_{studentUid}`

- `classId`: classroom document ID.
- `studentId`: student UID.
- `status`: currently `active`.
- `joinedAt`: Firestore timestamp.

## Access Model

- Browser reads are scoped to the signed-in user, classroom owner, or active classroom member.
- Classroom membership creation and join-key verification remain server-only through Admin SDK routes.
- Admin SDK calls bypass Firestore rules and therefore require endpoint authentication, validation, ownership checks, and idempotency work in the application layer.
- Client-side writes cannot change user roles, classroom ownership, join keys, or membership state.

## Index Assessment

No composite indexes are currently required. Existing queries use one field:

- `classrooms.teacherId`.
- `classrooms.joinKeyHash`.
- `classMemberships.studentId`.

## Cloud Verification Gate

The project/database already exists and remains the approved Firestore source of truth. Cloud metadata discovery currently returns `403 PERMISSION_DENIED` for the available CLI authorization, so do not provision or replace a database. Local rules/emulator verification is valid for the implemented slices; cloud auth/database verification remains a credential/session gate.

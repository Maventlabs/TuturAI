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

## Phase 1 Runtime Evidence

- Firebase email/password registration was confirmed for one student and one teacher account.
- Onboarding writes completed with HTTP `201`; server session exchange completed with HTTP `200`.
- Protected requests now verify a Firebase Admin session cookie. The raw Firebase ID token is used only for the onboarding/session exchange and is not stored as the application cookie.
- Student and teacher route boundaries, logout, unauthorized redirect, and wrong-role API denial were verified in the browser.
- Firestore emulator rules suite passed 37 tests covering role escalation, PII isolation, classroom ownership/join-key tampering, outsider access, and server-only membership writes.

## Storage Boundary Decision

- Google Drive remains the teacher-owned storage for assignment attachments and student submission files; Firestore stores metadata and Drive file IDs.
- Cloudinary is reserved for audio/voice artifacts and must not replace the Google Drive assignment/submission path.

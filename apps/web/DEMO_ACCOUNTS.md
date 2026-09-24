# TuturAI - Local Test Notes

> Legacy Supabase demo credentials were removed. The active application uses Firebase
> Authentication and Firestore. Use test-environment accounts or the Firebase emulator.

## Testing Notes

- Create student and teacher accounts through Firebase Auth in the test environment.
- Onboarding stores the permanent `student` or `teacher` role server-side.
- Login routes users to `/siswa` or `/guru` according to the verified role.
- A role mismatch must redirect or fail closed; do not bypass auth with a demo cookie.
- Logout is available from the profile menu.

## Routes To Verify

### Student

- `/siswa` dashboard, classroom membership, assignments, and progress states.
- `/siswa/speaking` recording and explicit provider failure states.
- `/siswa/pronunciation`, `/siswa/vocabulary`, `/siswa/listening`, and `/siswa/quiz`.
- `/siswa/leaderboard`, `/siswa/achievements`, and `/siswa/profil`.

### Teacher

- `/guru/kelas` classroom and member management.
- `/guru/penugasan` assignment lifecycle.
- `/guru/penilaian` review queue and approve/return actions.
- `/guru/analitik`, `/guru/leaderboard`, `/guru/perangkat`, and `/guru/pengaturan`.

## Troubleshooting

1. Confirm the Next.js dev server is running with `pnpm dev`.
2. Confirm Firebase client configuration and server credentials are present in the environment files.
3. For local rules tests, run the Firestore emulator through the repository test command.
4. Do not add Supabase credentials, hardcode passwords, or treat a client-side fallback as authentication.

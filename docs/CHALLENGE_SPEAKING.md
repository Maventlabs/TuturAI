# Challenge Speaking (Real-Life Challenge Speaking)

## Deskripsi Fitur
Fitur peer-to-peer speaking practice yang memungkinkan siswa berlatih berbicara Bahasa Inggris dengan siswa lain secara real-time melalui video/audio call. Terinspirasi dari konsep "random chat" (seperti Omegle/Discord), namun dirancang khusus untuk lingkungan pendidikan yang aman dan terstruktur.

## 3 Mode Matching
1. **Random 1v1**: Dipasangkan dengan 1 siswa lain secara acak
2. **Random Group**: Dipasangkan dengan hingga 3 siswa lain secara acak (maks 4 orang)
3. **Private Room**: Buat room dengan kode unik (maks 4 orang), ajak teman

## 2 Mode Permainan
1. **Instruction Mode**: Semua peserta mendapat topik yang sama, tapi setiap peserta mendapat instruksi berbeda (role-based)
2. **Free Play Mode**: Semua peserta mendapat topik umum, bicara bebas tanpa instruksi khusus

## Tech Stack
- **Frontend**: Netlify (static hosting), Next.js, React, Tailwind CSS
- **Matchmaking & State**: Firebase Realtime Database (max 100 concurrent connections, 10GB/month)
- **WebRTC Video/Audio**: LiveKit Cloud (max 100 concurrent connections, 5000 mins/month)
- **Authentication**: Firebase Auth (existing)

## Arsitektur
```
Student Browser (Netlify Static)
  ├── Firebase RTDB (matchmaking queue, room state, participant list)
  ├── LiveKit Cloud (WebRTC video/audio streaming)
  └── Next.js API Routes (LiveKit token generation)
```

### Firebase Room ID = LiveKit Room Name
- Firebase RTDB node: `/rooms/{roomId}`
- LiveKit room name = same `roomId`
- Frontend generates room ID, stores in Firebase, uses same ID for LiveKit connection

### User Flow
1. Student selects matching mode (1v1/Group/Private) and game model (Instruction/Free Play)
2. System searches for matching partners (Firebase RTDB queue)
3. When match found, room is created with unique ID
4. All participants connect to LiveKit room using same ID
5. Topic and instructions are displayed
6. Session runs for 3-5 minutes
7. Post-session: rating, XP reward

## Environment Variables
```
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

## Status: UI Implemented (Demo Mode)
- ✅ Main menu with 3 matching modes
- ✅ Lobby/waiting state with countdown timer
- ✅ Room UI with video grid (1v1 split / 4-person grid)
- ✅ Topic header and instruction card
- ✅ Game model selector (Instruction / Free Play)
- ✅ Private room code generation and join
- ⏳ LiveKit SDK integration (placeholder)
- ⏳ Firebase RTDB matchmaking (placeholder)
- ⏳ Real-time participant sync (placeholder)

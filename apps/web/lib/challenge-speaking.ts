import { getFirebaseApp } from '@/lib/firebase/client'
import { getDatabase, ref, set, get, push, onValue, remove, update, serverTimestamp, onDisconnect, type Database } from 'firebase/database'

let db: Database | null = null

function getDatabaseUrl(): string | undefined {
  const fromEnv = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.trim()
  if (fromEnv) return fromEnv
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
  // Default region for this project (TuturAI) is asia-southeast1.
  // Prefer setting NEXT_PUBLIC_FIREBASE_DATABASE_URL explicitly (copy from Firebase Console).
  if (projectId) return `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`
  return undefined
}

export function getChallengeDb(): Database {
  if (!db) {
    const url = getDatabaseUrl()
    const app = getFirebaseApp()
    db = url ? getDatabase(app, url) : getDatabase(app)
  }
  return db
}

export function getChallengeDbDiagnostics() {
  return {
    databaseUrl: getDatabaseUrl() ?? null,
    hasDatabaseUrl: Boolean(getDatabaseUrl()),
  }
}

// ─── Room Management ──────────────────────────────────────────────────────────

export interface ChallengeRoom {
  id: string
  mode: '1v1' | 'group' | 'private'
  gameModel: 'instruction' | 'freeplay'
  topic: string
  hostId: string
  hostName: string
  participants: Record<string, {
    uid: string
    name: string
    role: string
    joinedAt: number
    isMuted: boolean
    isCameraOff: boolean
  }>
  maxParticipants: number
  status: 'waiting' | 'active' | 'ended'
  createdAt: number
  code?: string
}

export interface MatchmakingEntry {
  uid: string
  name: string
  level: number
  mode: '1v1' | 'group'
  gameModel: 'instruction' | 'freeplay'
  timestamp: number
}

// ─── Matchmaking Queue ───────────────────────────────────────────────────────

export async function joinMatchmakingQueue(entry: MatchmakingEntry): Promise<void> {
  const database = getChallengeDb()
  const queueRef = ref(database, `matchmaking/${entry.mode}/${entry.uid}`)
  await set(queueRef, {
    ...entry,
    timestamp: serverTimestamp(),
  })
}

export async function leaveMatchmakingQueue(uid: string, mode: '1v1' | 'group'): Promise<void> {
  const database = getChallengeDb()
  const queueRef = ref(database, `matchmaking/${mode}/${uid}`)
  await remove(queueRef)
}

export function listenForMatch(
  uid: string,
  mode: '1v1' | 'group',
  callback: (roomId: string | null) => void,
): () => void {
  const database = getChallengeDb()
  const matchRef = ref(database, `matches/${uid}`)
  const unsubscribe = onValue(matchRef, (snapshot) => {
    const data = snapshot.val()
    if (data?.roomId) {
      callback(data.roomId)
    }
  })
  return unsubscribe
}

// ─── Room CRUD ───────────────────────────────────────────────────────────────

export async function createRoom(room: Omit<ChallengeRoom, 'id' | 'createdAt'>): Promise<string> {
  const database = getChallengeDb()
  const roomsRef = ref(database, 'rooms')
  const newRoomRef = push(roomsRef)
  const roomId = newRoomRef.key!
  await set(newRoomRef, {
    ...room,
    createdAt: serverTimestamp(),
    status: 'waiting',
  })
  return roomId
}

export async function getRoom(roomId: string): Promise<ChallengeRoom | null> {
  const database = getChallengeDb()
  const roomRef = ref(database, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) return null
  return { id: roomId, ...snapshot.val() } as ChallengeRoom
}

export async function joinRoom(roomId: string, participant: { uid: string; name: string; role: string }): Promise<void> {
  const database = getChallengeDb()
  const participantRef = ref(database, `rooms/${roomId}/participants/${participant.uid}`)
  await set(participantRef, {
    uid: participant.uid,
    name: participant.name,
    role: participant.role,
    joinedAt: serverTimestamp(),
    isMuted: false,
    isCameraOff: false,
  })
}

export async function leaveRoom(roomId: string, uid: string): Promise<void> {
  const database = getChallengeDb()
  const participantRef = ref(database, `rooms/${roomId}/participants/${uid}`)
  await remove(participantRef)
}

export function listenToRoom(
  roomId: string,
  callback: (room: ChallengeRoom | null) => void,
): () => void {
  const database = getChallengeDb()
  const roomRef = ref(database, `rooms/${roomId}`)
  const unsubscribe = onValue(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null)
      return
    }
    callback({ id: roomId, ...snapshot.val() } as ChallengeRoom)
  })
  return unsubscribe
}

export async function updateParticipantStatus(
  roomId: string,
  uid: string,
  status: { isMuted?: boolean; isCameraOff?: boolean },
): Promise<void> {
  const database = getChallengeDb()
  const participantRef = ref(database, `rooms/${roomId}/participants/${uid}`)
  await update(participantRef, status)
}

export async function endRoom(roomId: string): Promise<void> {
  const database = getChallengeDb()
  const roomRef = ref(database, `rooms/${roomId}`)
  await update(roomRef, { status: 'ended' })
}

// ─── Private Room Code ───────────────────────────────────────────────────────

// ─── Presence (online users) ─────────────────────────────────────────────────

export interface PresenceEntry {
  uid: string
  name: string
  level: number
  timestamp: number
}

export async function setPresence(uid: string, name: string, level: number): Promise<void> {
  const database = getChallengeDb()
  const presenceRef = ref(database, `presence/${uid}`)
  // Auto-cleanup when user closes tab / disconnects
  await onDisconnect(presenceRef).remove()
  await set(presenceRef, {
    uid,
    name,
    level,
    timestamp: serverTimestamp(),
  })
}

export async function removePresence(uid: string): Promise<void> {
  const database = getChallengeDb()
  await remove(ref(database, `presence/${uid}`))
}

export function listenToPresence(
  callback: (users: PresenceEntry[]) => void,
): () => void {
  const database = getChallengeDb()
  const presenceRef = ref(database, 'presence')
  return onValue(presenceRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([])
      return
    }
    const val = snapshot.val() as Record<string, PresenceEntry>
    callback(Object.values(val))
  })
}

export function listenToPresenceCount(
  callback: (count: number) => void,
): () => void {
  return listenToPresence((users) => callback(users.length))
}

export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function findRoomByCode(code: string): Promise<ChallengeRoom | null> {
  const database = getChallengeDb()
  const roomsRef = ref(database, 'rooms')
  const snapshot = await get(roomsRef)
  if (!snapshot.exists()) return null
  const rooms = snapshot.val()
  for (const [id, room] of Object.entries(rooms)) {
    if ((room as ChallengeRoom).code === code && (room as ChallengeRoom).status === 'waiting') {
      return { ...(room as ChallengeRoom), id }
    }
  }
  return null
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { MatchStage, PresenceStrip } from '@/components/student/challenge-speaking/match-stage'
import { SettingsConsole, HowItWorks } from '@/components/student/challenge-speaking/settings-console'
import { RoomStage } from '@/components/student/challenge-speaking/room-stage'
import { useLiveKit } from '@/hooks/use-livekit'
import { usePresence } from '@/hooks/use-presence'
import {
  createRoom,
  joinRoom,
  listenToRoom,
  endRoom,
  generateRoomCode,
  type ChallengeRoom,
} from '@/lib/challenge-speaking'

// ─── Types ───────────────────────────────────────────────────────────────────

type MatchMode = '1v1' | 'group' | 'private'
type GameModel = 'instruction' | 'freeplay'
type PageState = 'menu' | 'lobby' | 'room'

// ─── Mock Data (fallback for demo) ──────────────────────────────────────────

const MOCK_TOPICS = [
  'Describe your favorite holiday destination',
  'What are the benefits of learning a new language?',
  'Discuss the impact of technology on education',
  'How do you handle stress in daily life?',
  'What is your dream job and why?',
]

const MOCK_INSTRUCTIONS: Record<string, string> = {
  speaker_1: 'Ask your partner 3 questions about their daily routine. Listen carefully and respond naturally.',
  speaker_2: "Answer your partner's questions about your daily routine. Provide detailed and interesting responses.",
  speaker_3: 'Summarize what you heard from the conversation. Add your own thoughts.',
  speaker_4: 'Ask follow-up questions based on the summary. Keep the conversation flowing.',
}

const MODE_LABELS: Record<MatchMode, string> = {
  '1v1': 'Random 1v1',
  group: 'Random group',
  private: 'Private room',
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ChallengeSpeakingPage() {
  const [pageState, setPageState] = useState<PageState>('menu')
  const [matchMode, setMatchMode] = useState<MatchMode>('1v1')
  const [gameModel, setGameModel] = useState<GameModel>('instruction')
  const [lobbyTimer, setLobbyTimer] = useState(15)
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [roomData, setRoomData] = useState<ChallengeRoom | null>(null)
  const [myRole, setMyRole] = useState<string>('speaker_1')
  const [topic, setTopic] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{ uid: string; name: string; level: number } | null>(null)
  const [rtdbReady, setRtdbReady] = useState<boolean | null>(null)

  const livekit = useLiveKit()
  const presence = usePresence(currentUser)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Load current user from /api/me
  useEffect(() => {
    let cancelled = false
    fetch('/api/me', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('ME_FAILED')
        const payload = await res.json()
        if (!cancelled && payload.data?.user) {
          setCurrentUser({
            uid: payload.data.user.uid,
            name: payload.data.profile?.full_name ?? payload.data.user.displayName ?? 'Siswa',
            level: payload.data.profile?.level ?? 1,
          })
        }
      })
      .catch(() => {
        // Keep demo fallback if needed, but surface error in UI
      })
    return () => { cancelled = true }
  }, [])

  // Check RTDB config presence
  useEffect(() => {
    setRtdbReady(Boolean(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current()
      livekit.disconnect()
    }
  }, [])

  // Simulate matchmaking countdown (will be replaced with Firebase RTDB listener)
  useEffect(() => {
    if (pageState !== 'lobby') return
    if (lobbyTimer <= 0) {
      // Create room with mock data for demo
      const topicIndex = Date.now() % MOCK_TOPICS.length
      const selectedTopic = MOCK_TOPICS[topicIndex]
      const maxP = matchMode === '1v1' ? 2 : 4
      const code = matchMode === 'private' ? roomCode : undefined

      const uid = currentUser?.uid ?? 'demo-user'
      const myName = currentUser?.name ?? 'Kamu'
      createRoom({
        mode: matchMode,
        gameModel,
        topic: selectedTopic,
        hostId: uid,
        hostName: myName,
        participants: {
          [uid]: { uid, name: myName, role: 'speaker_1', joinedAt: Date.now(), isMuted: false, isCameraOff: false },
        },
        maxParticipants: maxP,
        code,
        status: 'waiting',
      }).then(async (roomId) => {
        try {
          await joinRoom(roomId, { uid, name: myName, role: 'speaker_1' })
        } catch {
          // ignore if RTDB unavailable, continue with local state
        }
        setRoomData({
          id: roomId,
          mode: matchMode,
          gameModel,
          topic: selectedTopic,
          hostId: uid,
          hostName: myName,
          participants: {
            [uid]: { uid, name: myName, role: 'speaker_1', joinedAt: Date.now(), isMuted: false, isCameraOff: false },
          },
          maxParticipants: maxP,
          status: 'waiting',
          createdAt: Date.now(),
          code,
        })
        setTopic(selectedTopic)
        setMyRole('speaker_1')

        // Listen to room changes
        const unsub = listenToRoom(roomId, (room) => {
          if (room) {
            setRoomData(room)
          }
        })
        unsubscribeRef.current = unsub

        // Get LiveKit token
        fetchLiveKitToken(roomId, uid).then((tokenData) => {
          if (tokenData) {
            livekit.connect(tokenData.token, tokenData.url, roomId)
          }
        })

        setPageState('room')
      }).catch((err) => {
        const msg = err instanceof Error ? err.message : ''
        setError(
          rtdbReady === false
            ? 'Room tidak bisa dibuat karena Firebase Realtime Database belum terkonfigurasi. Isi NEXT_PUBLIC_FIREBASE_DATABASE_URL lalu restart dev server.'
            : `Gagal membuat room.${msg ? ` ${msg}` : ''}`,
        )
        setPageState('menu')
      })
      return
    }
    const timer = setTimeout(() => setLobbyTimer((t) => t - 1), 1000)
    return () => clearTimeout(timer)
  }, [pageState, lobbyTimer, matchMode, gameModel, roomCode])

  async function fetchLiveKitToken(roomName: string, participantName: string) {
    try {
      const res = await fetch('/api/student/challenge-speaking/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.data
    } catch {
      return null
    }
  }

  function startMatch() {
    setLobbyTimer(15)
    setError(null)
    setPageState('lobby')
  }

  function createPrivateRoom() {
    const code = generateRoomCode()
    setRoomCode(code)
    setMatchMode('private')
    setLobbyTimer(0)
    setPageState('lobby')
  }

  function joinPrivateRoom() {
    if (joinCode.length < 4) return
    setMatchMode('private')
    setLobbyTimer(10)
    setError(null)
    setPageState('lobby')
  }

  function cancelMatch() {
    setPageState('menu')
    setError(null)
  }

  function leaveRoom() {
    if (roomData) {
      endRoom(roomData.id).catch(() => {})
      livekit.disconnect()
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    setPageState('menu')
    setRoomData(null)
    setMatchMode('1v1')
    setRoomCode('')
    setJoinCode('')
    setError(null)
  }

  function copyCode() {
    const code = roomCode || roomData?.code || roomData?.id || ''
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const participants = roomData?.participants ? Object.values(roomData.participants) : []
  const modeLabel = MODE_LABELS[matchMode]
  const gameLabel = gameModel === 'instruction' ? 'Instruksi' : 'Free play'

  // ─── Menu State ──────────────────────────────────────────────────────────

  if (pageState === 'menu') {
    const isPrivate = matchMode === 'private'

    return (
      <div className="mx-auto max-w-5xl">
        <header className="mb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Matchmaking
          </p>
          <h1 className="mt-1.5 text-balance font-heading text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Challenge Speaking
          </h1>
          <p className="mt-1.5 max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground">
            Latih kemampuan berbicara Bahasa Inggris dengan siswa lain secara real-time. Pilih mode,
            lalu cari partner.
          </p>
        </header>

        {rtdbReady === false && (
          <div className="mb-3 flex items-start gap-2.5 border border-warning/30 bg-warning/10 px-3.5 py-2.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <p className="text-[12px] leading-relaxed text-foreground">
              Mode demo — Firebase Realtime Database belum terkonfigurasi. Isi{' '}
              <code className="font-mono text-[11px]">NEXT_PUBLIC_FIREBASE_DATABASE_URL</code> di{' '}
              <code className="font-mono text-[11px]">.env.local</code> lalu restart dev server.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-3 flex items-start gap-2.5 border border-destructive/30 bg-destructive/10 px-3.5 py-2.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            <p role="alert" className="text-[12px] leading-relaxed text-foreground">
              {error}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
          <div className="min-w-0 flex-1 space-y-3 md:sticky md:top-20">
            <MatchStage
              state="standby"
              name={currentUser?.name ?? 'Kamu'}
              level={currentUser?.level ?? 1}
              modeLabel={modeLabel}
              gameLabel={gameLabel}
              onlineCount={presence.onlineCount}
              footer={
                <button
                  type="button"
                  onClick={isPrivate ? createPrivateRoom : startMatch}
                  className="group flex h-12 w-full items-center justify-between gap-3 bg-primary px-4 text-primary-foreground transition-colors hover:bg-primary-deep"
                >
                  <span className="font-heading text-sm font-bold tracking-tight">
                    {isPrivate ? 'Buat room' : 'Cari partner'}
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
                    {modeLabel}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              }
            />

            <PresenceStrip users={presence.users} error={presence.error} />
          </div>

          <div className="w-full space-y-3 md:w-[320px] md:shrink-0 lg:w-[380px]">
            <SettingsConsole
              gameModel={gameModel}
              onGameModelChange={setGameModel}
              matchMode={matchMode}
              onMatchModeChange={setMatchMode}
              joinCode={joinCode}
              onJoinCodeChange={setJoinCode}
              onJoin={joinPrivateRoom}
            />
            <HowItWorks />
          </div>
        </div>
      </div>
    )
  }

  // ─── Lobby State ─────────────────────────────────────────────────────────

  if (pageState === 'lobby') {
    return (
      <div className="mx-auto max-w-2xl">
        <header className="mb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Matchmaking
          </p>
          <h1 className="mt-1.5 font-heading text-2xl font-extrabold tracking-tight text-foreground">
            Mencari partner
          </h1>
          <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
            Sistem sedang mencarikan partner yang sesuai. Jangan tutup halaman ini.
          </p>
        </header>

        <MatchStage
          state="scanning"
          name={currentUser?.name ?? 'Kamu'}
          level={currentUser?.level ?? 1}
          modeLabel={modeLabel}
          gameLabel={gameLabel}
          onlineCount={presence.onlineCount}
          countdown={lobbyTimer}
          footer={
            <button
              type="button"
              onClick={cancelMatch}
              className="flex h-12 w-full items-center justify-center border border-white/15 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-foreground transition-colors hover:bg-white/10"
            >
              Batalkan pencarian
            </button>
          }
        />
      </div>
    )
  }

  // ─── Room State ──────────────────────────────────────────────────────────

  if (pageState === 'room' && roomData) {
    return (
      <RoomStage
        topic={topic || roomData.topic}
        gameModel={gameModel}
        myRole={myRole}
        instruction={MOCK_INSTRUCTIONS[myRole] ?? 'Bicara bebas tentang topik di atas.'}
        mode={roomData.mode}
        maxParticipants={roomData.maxParticipants}
        code={roomData.code || roomData.id}
        participants={participants}
        livekit={{
          connected: livekit.connected,
          connecting: livekit.connecting,
          error: livekit.error,
          isMuted: livekit.isMuted,
          isCameraOff: livekit.isCameraOff,
          toggleMute: livekit.toggleMute,
          toggleCamera: livekit.toggleCamera,
        }}
        copied={copied}
        onCopyCode={copyCode}
        onLeave={leaveRoom}
      />
    )
  }

  return null
}

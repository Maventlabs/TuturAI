'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Hash,
  Video,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Loader2,
  Clock,
  Copy,
  Check,
  Sparkles,
  MessageSquare,
} from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useLiveKit } from '@/hooks/use-livekit'
import { usePresence } from '@/hooks/use-presence'
import {
  joinMatchmakingQueue,
  leaveMatchmakingQueue,
  createRoom,
  joinRoom,
  listenToRoom,
  endRoom,
  generateRoomCode,
  findRoomByCode,
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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ChallengeSpeakingPage() {
  const [pageState, setPageState] = useState<PageState>('menu')
  const [matchMode, setMatchMode] = useState<MatchMode | null>(null)
  const [gameModel, setGameModel] = useState<GameModel>('instruction')
  const [lobbyTimer, setLobbyTimer] = useState(15)
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [roomData, setRoomData] = useState<ChallengeRoom | null>(null)
  const [myRole, setMyRole] = useState<string>('speaker_1')
  const [topic, setTopic] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
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
        mode: matchMode!,
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
          mode: matchMode!,
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
        const hint = rtdbReady === false ? ' RTDB belum terkonfigurasi (isi NEXT_PUBLIC_FIREBASE_DATABASE_URL).' : ''
        setError(`Gagal membuat room.${hint} ${msg ? msg : ''}`.trim())
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

  function startMatch(mode: MatchMode) {
    setMatchMode(mode)
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
    setMatchMode(null)
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

  const participants = roomData?.participants
    ? Object.values(roomData.participants)
    : []
  const is1v1 = (roomData?.maxParticipants ?? 4) <= 2
  const gridCols = is1v1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'

  // ─── Menu State ──────────────────────────────────────────────────────────

  if (pageState === 'menu') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Challenge Speaking"
          description="Latih kemampuan berbicara Bahasa Inggris dengan siswa lain secara real-time. Pilih mode yang kamu inginkan."
        />

        {rtdbReady === false && (
          <Card className="border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Mode demo: Firebase Realtime Database belum terkonfigurasi. Isi <code>NEXT_PUBLIC_FIREBASE_DATABASE_URL</code> di <code>.env.local</code> lalu restart dev server.
            </p>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/30 bg-destructive/10 p-4">
            <p role="alert" className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {/* Online users (overall) */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Online sekarang</p>
              <p className="text-xs text-muted-foreground">
                {presence.onlineCount === null
                  ? 'Memuat jumlah pengguna online…'
                  : `${presence.onlineCount} siswa sedang online`}
                {presence.error ? ` — ${presence.error}` : ''}
              </p>
            </div>
            <Badge variant="secondary">{presence.onlineCount ?? '…'}</Badge>
          </div>
          {presence.users.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {presence.users.slice(0, 8).map((u) => (
                <Badge key={u.uid} variant="outline" className="text-[11px]">
                  {u.name}
                </Badge>
              ))}
              {presence.users.length > 8 && (
                <Badge variant="outline" className="text-[11px]">+{presence.users.length - 8}</Badge>
              )}
            </div>
          )}
        </Card>

        {/* Game Model Selector */}
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Pilih Mode Permainan</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setGameModel('instruction')}
              className={`rounded-xl border p-3 text-left transition-all ${
                gameModel === 'instruction'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50'
              }`}
            >
              <p className="text-sm font-semibold">Instruction Mode</p>
              <p className="mt-1 text-xs">Setiap siswa mendapat instruksi berbeda berdasarkan topik yang sama</p>
            </button>
            <button
              onClick={() => setGameModel('freeplay')}
              className={`rounded-xl border p-3 text-left transition-all ${
                gameModel === 'freeplay'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50'
              }`}
            >
              <p className="text-sm font-semibold">Free Play Mode</p>
              <p className="mt-1 text-xs">Bicara bebas seperti Omegle tanpa instruksi khusus</p>
            </button>
          </div>
        </Card>

        {/* Matching Modes */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Pilih Mode Matching</p>

          <Card
            className="group cursor-pointer p-4 transition-all hover:border-primary/50 hover:shadow-md"
            onClick={() => startMatch('1v1')}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Random 1v1</p>
                <p className="text-xs text-muted-foreground">Dipasangkan dengan 1 siswa lain secara acak</p>
              </div>
              <Badge variant="secondary">2 orang</Badge>
            </div>
          </Card>

          <Card
            className="group cursor-pointer p-4 transition-all hover:border-primary/50 hover:shadow-md"
            onClick={() => startMatch('group')}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Users className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Random Group</p>
                <p className="text-xs text-muted-foreground">Dipasangkan dengan hingga 3 siswa lain secara acak</p>
              </div>
              <Badge variant="secondary">Maks 4 orang</Badge>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                <Hash className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Private Room</p>
                <p className="text-xs text-muted-foreground">Buat room dengan kode unik, ajak teman</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1" onClick={createPrivateRoom}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                Buat Room
              </Button>
              <div className="flex flex-1 gap-2">
                <Input
                  placeholder="Masukkan kode"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="text-center uppercase tracking-widest"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={joinPrivateRoom}
                  disabled={joinCode.length < 4}
                >
                  Gabung
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-semibold text-foreground">Cara Kerja</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pilih mode matching dan mode permainan. Sistem akan mencarikan partner. Setiap sesi berdurasi 3-5 menit dengan topik yang sama untuk semua peserta.
              </p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // ─── Lobby State ─────────────────────────────────────────────────────────

  if (pageState === 'lobby') {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <PageHeader
          title="Mencari Partner..."
          description="Mohon tunggu, sistem sedang mencarikan partner yang sesuai."
        />

        <Card className="flex flex-col items-center gap-6 p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary/20 border-t-primary animate-spin">
            <Loader2 className="h-8 w-8 text-primary" />
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">Mencari partner...</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Mode: {matchMode === '1v1' ? 'Random 1v1' : matchMode === 'group' ? 'Random Group' : 'Private Room'}
            </p>
            <p className="text-sm text-muted-foreground">
              Permainan: {gameModel === 'instruction' ? 'Instruction Mode' : 'Free Play Mode'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Clock className="h-6 w-6" />
            <span>{lobbyTimer}s</span>
          </div>

          <p className="text-xs text-muted-foreground">Level matching: ±1 level dari levelmu</p>

          <Button
            variant="outline"
            onClick={() => {
              setPageState('menu')
              setMatchMode(null)
            }}
          >
            Batalkan
          </Button>
        </Card>
      </div>
    )
  }

  // ─── Room State ──────────────────────────────────────────────────────────

  if (pageState === 'room' && roomData) {
    const is1v1 = (roomData.maxParticipants ?? 4) <= 2
    const gridCols = is1v1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'
    const displayParticipants = participants.length > 0 ? participants : [
      { uid: 'me', name: 'Kamu', role: 'speaker_1', isMuted: false, isCameraOff: false, isSpeaking: false, joinedAt: 0 },
    ]

    return (
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Topic Header */}
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Topik</p>
              <h2 className="mt-1 text-lg font-bold text-foreground">{topic || roomData.topic}</h2>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {displayParticipants.length}/{roomData.maxParticipants} orang
            </Badge>
          </div>
        </Card>

        {/* Instruction Card */}
        {gameModel === 'instruction' && (
          <Card className="border-accent/20 bg-accent/5 p-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Instruksimu ({myRole})
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {MOCK_INSTRUCTIONS[myRole] ?? 'Bicara bebas tentang topik di atas.'}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Free Play indicator */}
        {gameModel === 'freeplay' && (
          <Card className="border-success/20 bg-success/15 p-3">
            <p className="text-center text-sm text-foreground">
              <Sparkles className="mr-1.5 inline h-4 w-4 text-success" />
              Free Play Mode — Bicara bebas tanpa instruksi khusus
            </p>
          </Card>
        )}

        {/* LiveKit connection status */}
        {livekit.connecting && (
          <Card className="border-primary/20 bg-primary/5 p-3">
            <p className="text-center text-sm text-primary">
              <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />
              Menghubungkan ke room...
            </p>
          </Card>
        )}
        {livekit.error && (
          <Card className="border-destructive/20 bg-destructive/10 p-3">
            <p className="text-center text-sm text-destructive">
              Koneksi gagal: {livekit.error}. Menggunakan mode demo.
            </p>
          </Card>
        )}

        {/* Video Grid */}
        <div className={`grid gap-3 ${gridCols}`}>
          {displayParticipants.map((p, i) => (
            <Card
              key={p.uid || i}
              className={`relative aspect-video overflow-hidden bg-muted ${
                (p as any).isSpeaking ? 'ring-2 ring-success' : ''
              }`}
            >
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/80">
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {(p.name || '?').charAt(0)}
                  </div>
                  <p className="text-sm font-medium text-foreground">{p.name || 'Peserta'}</p>
                  {p.uid === 'me' && (
                    <Badge variant="secondary" className="mt-1 text-[10px]">Kamu</Badge>
                  )}
                </div>
              </div>

              <div className="absolute bottom-2 left-2 flex gap-1.5">
                {(p as any).isMuted && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/80 text-white">
                    <MicOff className="h-3 w-3" />
                  </span>
                )}
                {(p as any).isCameraOff && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/80 text-white">
                    <VideoOff className="h-3 w-3" />
                  </span>
                )}
              </div>

              <div className="absolute bottom-2 right-2 rounded-md bg-black/50 px-2 py-0.5 text-xs text-white">
                {p.name || 'Peserta'}
              </div>
            </Card>
          ))}

          {/* Empty slots for private room */}
          {roomData.mode === 'private' &&
            Array.from({ length: roomData.maxParticipants - displayParticipants.length }).map((_, i) => (
              <Card
                key={`empty-${i}`}
                className="flex aspect-video items-center justify-center border-dashed bg-muted/30"
              >
                <p className="text-xs text-muted-foreground">Menunggu peserta...</p>
              </Card>
            ))}
        </div>

        {/* Controls */}
        <Card className="flex items-center justify-center gap-3 p-4">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={livekit.toggleMute}
            aria-label="Toggle mic"
          >
            {livekit.isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={livekit.toggleCamera}
            aria-label="Toggle camera"
          >
            {livekit.isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
          {roomData.mode === 'private' && (
            <Button variant="outline" size="sm" onClick={copyCode} className="gap-1.5">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Tersalin!' : `Kode: ${roomData.code || roomData.id}`}
            </Button>
          )}
          <Button
            variant="destructive"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={leaveRoom}
            aria-label="Keluar dari room"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </Card>

        {/* Status note */}
        <Card className="border-primary/10 bg-primary/5 p-3">
          <p className="text-center text-[10px] text-muted-foreground">
            {livekit.connected
              ? 'Terhubung ke LiveKit room'
              : 'Mode demo - LiveKit keys belum dikonfigurasi. Tambahkan ke .env.local'}
          </p>
        </Card>
      </div>
    )
  }

  return null
}

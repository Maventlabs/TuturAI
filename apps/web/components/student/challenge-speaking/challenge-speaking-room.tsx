'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Info, Loader2, RotateCw, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePresence } from '@/hooks/use-presence'
import { cn } from '@/lib/utils'
import { CallControls } from './call-controls'
import { DeviceSettingsDialog } from './device-settings-dialog'
import { formatClock, initialsOf } from './format'
import { MatchmakingSettings, PrimaryAction } from './matchmaking-settings'
import { FreePlayPanel, MissionDialog, MissionPanel } from './mission-card'
import { EmptySlotTile, ParticipantTile, TextModeNotice } from './participant-tile'
import { ReportDialog } from './report-dialog'
import { RoomChat } from './room-chat'
import { SessionSummary } from './session-summary'
import { useLocalMedia } from './use-local-media'
import { useMatchmaking } from './use-matchmaking'
import { GAME_MODEL_LABEL, MATCH_MODE_LABEL, type Phase, type TileState } from './types'

interface ChallengeSpeakingRoomProps {
  student: {
    uid: string
    name: string
    level: number
  }
}

const SESSION_PHASES: Phase[] = ['connecting', 'mission', 'active', 'reconnecting', 'partner-left']

const PHASE_LABEL: Record<Phase, string> = {
  lobby: 'Siap',
  searching: 'Mencari partner',
  connecting: 'Menghubungkan',
  mission: 'Misi sesi',
  active: 'Sesi aktif',
  reconnecting: 'Menyambung ulang',
  'partner-left': 'Partner keluar',
  ended: 'Sesi selesai',
}

const PREVIEW_OPTIONS: Array<{ value: Phase; label: string }> = [
  { value: 'lobby', label: 'Lobby' },
  { value: 'searching', label: 'Mencari' },
  { value: 'connecting', label: 'Menghubungkan' },
  { value: 'mission', label: 'Misi' },
  { value: 'active', label: 'Sesi aktif' },
  { value: 'reconnecting', label: 'Menyambung ulang' },
  { value: 'partner-left', label: 'Partner keluar' },
  { value: 'ended', label: 'Sesi selesai' },
]

function StatusChip({ phase, sessionSeconds }: { phase: Phase; sessionSeconds: number }) {
  const tone =
    phase === 'active'
      ? 'bg-success/10 text-success ring-success/25'
      : phase === 'searching' || phase === 'connecting' || phase === 'mission'
        ? 'bg-primary/10 text-primary-deep ring-primary/25'
        : phase === 'reconnecting' || phase === 'partner-left'
          ? 'bg-warning/10 text-warning ring-warning/25'
          : 'bg-secondary text-muted-foreground ring-rule'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ring-1',
        tone,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {PHASE_LABEL[phase]}
      {phase === 'active' && <span className="tabular-nums">· {formatClock(sessionSeconds)}</span>}
    </span>
  )
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 ring-1 ring-foreground/10">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className="font-mono text-[10px] tabular-nums text-foreground">{value}</span>
    </span>
  )
}

function SessionStatusPanel({
  tone,
  title,
  detail,
  children,
}: {
  tone: 'info' | 'warning'
  title: string
  detail: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl p-3 ring-1 sm:flex-row sm:items-center sm:justify-between',
        tone === 'warning' ? 'bg-warning/10 ring-warning/25' : 'bg-card ring-foreground/10',
      )}
    >
      <div className="flex items-start gap-2.5">
        {tone === 'warning' ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        ) : (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="font-heading text-[13px] font-bold tracking-tight text-foreground">{title}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
        </div>
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function ChallengeSpeakingRoom({ student }: ChallengeSpeakingRoomProps) {
  const media = useLocalMedia()
  const matchmaking = useMatchmaking({ studentName: student.name, studentLevel: student.level })
  const presenceEnabled = Boolean(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL)
  const presence = usePresence(
    presenceEnabled && student.uid ? { uid: student.uid, name: student.name, level: student.level } : null,
  )

  const [devicesOpen, setDevicesOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [missionOpen, setMissionOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)

  const {
    phase,
    partners,
    mission,
    searchSeconds,
    sessionSeconds,
    sessionElapsed,
    messages,
    roomCode,
    gameModel,
    matchMode,
    mediaPreference,
    startSearch,
    joinWithCode,
    cancelSearch,
    startSession,
    endSession,
    returnToLobby,
    sendMessage,
    previewState,
  } = matchmaking

  const inSession = SESSION_PHASES.includes(phase)
  const showSettings = phase === 'lobby' || phase === 'searching'
  const locked = phase !== 'lobby' && phase !== 'ended'
  const partnerNames = partners.map((partner) => partner.name)

  const stopAllMedia = media.stopAll

  useEffect(() => {
    if (phase === 'ended') stopAllMedia()
  }, [phase, stopAllMedia])

  const missionDialogOpen = phase === 'mission' || (missionOpen && inSession)

  const remoteState: TileState = useMemo(() => {
    if (phase === 'lobby') return 'waiting'
    if (phase === 'searching') return matchMode === 'private' ? 'waiting' : 'searching'
    if (phase === 'connecting') return 'connecting'
    if (phase === 'reconnecting') return 'reconnecting'
    if (phase === 'partner-left') return 'left'
    if (phase === 'ended') return 'ended'
    if (mediaPreference === 'text') return 'text'
    if (mediaPreference === 'audio') return 'audio'
    return 'live'
  }, [matchMode, mediaPreference, phase])

  const showPartners = inSession || phase === 'ended'
  const emptySlots = matchMode === 'group' && inSession ? Math.max(0, 4 - 1 - partners.length) : 0
  const tileCount = showPartners ? 1 + partners.length + emptySlots : 2
  const isGroupGrid = matchMode === 'group' && inSession
  const gridClass = isGroupGrid ? 'grid-cols-2' : tileCount <= 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
  const tileClass = isGroupGrid ? 'aspect-[4/3] sm:aspect-video' : 'aspect-video'

  const handleStart = () => {
    if (mediaPreference !== 'text' && !media.micOn) {
      void media.enableMic(media.micId ?? undefined)
    }
    startSearch()
  }

  const handleJoin = () => {
    if (joinCode.length < 4) return
    if (mediaPreference !== 'text' && !media.micOn) {
      void media.enableMic(media.micId ?? undefined)
    }
    joinWithCode(joinCode)
  }

  const handleCopyCode = () => {
    if (!roomCode) return
    void navigator.clipboard?.writeText(roomCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const handleLeave = () => {
    if (phase === 'searching') {
      cancelSearch()
      return
    }
    if (inSession) {
      setLeaveOpen(true)
      return
    }
    returnToLobby()
  }

  const confirmLeave = () => {
    setLeaveOpen(false)
    setChatOpen(false)
    media.stopAll()
    endSession()
  }

  const mediaError = media.cameraError ?? media.micError
  const clearMediaError = () => {
    media.clearCameraError()
    media.clearMicError()
  }

  const controlHint =
    phase === 'lobby'
      ? 'Kamera dan mikrofon mati sampai kamu menyalakannya'
      : phase === 'searching'
        ? matchMode === 'private'
          ? 'Room menunggu peserta bergabung'
          : 'Mencari partner dengan level sama atau selisih satu'
        : phase === 'active' && mediaPreference === 'video' && !media.cameraOn
          ? 'Kamera mati — peserta lain hanya mendengar suaramu'
          : undefined

  const onlineLabel = presenceEnabled && presence.onlineCount !== null ? String(presence.onlineCount) : '—'

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="flex flex-col gap-2.5 border-b border-rule pb-3 sm:flex-row sm:items-end sm:justify-between sm:gap-3 sm:pb-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Matchmaking</p>
          <h1 className="mt-1 font-heading text-xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Challenge Speaking
          </h1>
          <p className="mt-1 max-w-xl text-pretty text-[13px] leading-relaxed text-muted-foreground sm:mt-1.5 sm:text-sm">
            Latih kemampuan berbicara Bahasa Inggris dengan siswa lain secara real-time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip phase={phase} sessionSeconds={sessionSeconds} />
          <MetaChip label="Level" value={String(student.level)} />
          <MetaChip label="Online" value={onlineLabel} />
        </div>
      </header>

      <div className="mt-3 flex flex-col gap-2 rounded-xl bg-warning/10 px-3.5 py-2.5 ring-1 ring-warning/25 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-[10px] leading-snug text-foreground sm:text-[11px] sm:leading-relaxed">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
          <span>
            <span className="font-semibold">Mode pratinjau UI.</span> Partner, misi, dan sesi disimulasikan.
            <span className="hidden sm:inline"> Real-time, moderasi, dan XP aktif pada tahap berikutnya.</span>
          </span>
        </p>
        <label className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Pratinjau</span>
          <select
            value={phase}
            onChange={(event) => previewState(event.target.value as Phase)}
            className="h-7 rounded-md border border-border bg-card px-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            {PREVIEW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p aria-live="polite" className="sr-only">
        {PHASE_LABEL[phase]}
        {phase === 'active' ? `, sisa waktu ${formatClock(sessionSeconds)}` : ''}
      </p>

      <section aria-label="Peserta sesi" className="mt-3 rounded-2xl bg-ink-deep p-1.5 ring-1 ring-white/10 sm:p-3">
        <div className={cn('grid gap-1.5 sm:gap-3', gridClass)}>
          <ParticipantTile
            role="local"
            name={student.name}
            level={student.level}
            state={media.cameraOn ? 'live' : 'idle'}
            micOn={media.micOn}
            cameraOn={media.cameraOn}
            stream={media.cameraStream}
            cameraPending={media.cameraPending}
            compact={isGroupGrid}
            onEnableCamera={() => void media.enableCamera(media.cameraId ?? undefined)}
            className={tileClass}
          />

          {showPartners
            ? partners.map((partner) => (
                <ParticipantTile
                  key={partner.uid}
                  role="remote"
                  name={partner.name}
                  level={partner.level}
                  state={remoteState}
                  micOn
                  cameraOn={false}
                  isDemo={partner.isDemo}
                  compact={isGroupGrid}
                  className={tileClass}
                />
              ))
            : (
                <ParticipantTile
                  role="remote"
                  name="Partner"
                  level={student.level}
                  levelLabel="Level ±1"
                  state={remoteState}
                  micOn={false}
                  cameraOn={false}
                  searchSeconds={searchSeconds}
                  className={tileClass}
                />
              )}

          {Array.from({ length: emptySlots }).map((_, index) => (
            <EmptySlotTile key={`empty-${index}`} className={tileClass} />
          ))}
        </div>

        {inSession && mediaPreference === 'text' && (
          <div className="mt-2">
            <TextModeNotice onOpenChat={() => setChatOpen(true)} />
          </div>
        )}
      </section>

      <div className={cn('mt-3 space-y-2', phase === 'ended' && 'hidden')}>
        <CallControls
          micOn={media.micOn}
          cameraOn={media.cameraOn}
          micPending={media.micPending}
          cameraPending={media.cameraPending}
          onToggleMic={media.toggleMic}
          onToggleCamera={media.toggleCamera}
          onOpenDevices={() => setDevicesOpen(true)}
          onOpenChat={inSession ? () => setChatOpen(true) : undefined}
          onOpenMission={mission ? () => setMissionOpen(true) : undefined}
          onOpenReport={inSession ? () => setReportOpen(true) : undefined}
          onLeave={phase === 'lobby' || phase === 'ended' ? undefined : handleLeave}
          leaveLabel={phase === 'searching' ? 'Batalkan' : 'Keluar'}
          leaveTone={phase === 'searching' ? 'neutral' : 'danger'}
          hint={controlHint}
        />

        {mediaError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 ring-1 ring-destructive/25"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
            <p className="flex-1 text-[11px] leading-relaxed text-foreground">{mediaError}</p>
            <button
              type="button"
              onClick={clearMediaError}
              aria-label="Tutup pesan kesalahan perangkat"
              className="rounded p-0.5 text-destructive transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {phase === 'ended' ? (
          <SessionSummary
            durationSeconds={sessionElapsed}
            matchMode={matchMode}
            gameModel={gameModel}
            mission={mission}
            participantNames={partnerNames}
            onReturn={returnToLobby}
            onSearchAgain={() => {
              returnToLobby()
              window.setTimeout(() => startSearch(), 0)
            }}
          />
        ) : showSettings ? (
          <>
            <MatchmakingSettings
              gameModel={gameModel}
              matchMode={matchMode}
              mediaPreference={mediaPreference}
              level={student.level}
              locked={locked}
              roomCode={roomCode}
              joinCode={joinCode}
              copied={copied}
              onGameModelChange={matchmaking.setGameModel}
              onMatchModeChange={matchmaking.setMatchMode}
              onMediaPreferenceChange={matchmaking.setMediaPreference}
              onJoinCodeChange={setJoinCode}
              onJoin={handleJoin}
              onCopyCode={handleCopyCode}
            />
            <PrimaryAction
              searching={phase === 'searching'}
              label={matchMode === 'private' ? 'Buat room privat' : 'Cari partner bicara'}
              meta={`${MATCH_MODE_LABEL[matchMode]} · Level ±1 · 3–5 mnt`}
              searchSeconds={searchSeconds}
              onStart={handleStart}
              onCancel={cancelSearch}
            />
          </>
        ) : phase === 'connecting' ? (
          <SessionStatusPanel
            tone="info"
            title={partnerNames.length > 0 ? `Menghubungkan ke ${partnerNames[0]}` : 'Menghubungkan'}
            detail="Menyiapkan koneksi media. Misi sesi muncul setelah kedua peserta terhubung."
          />
        ) : phase === 'reconnecting' ? (
          <SessionStatusPanel
            tone="warning"
            title="Menyambung ulang"
            detail="Koneksi terputus. Sesi dicoba dipulihkan tanpa membuat sesi baru."
          >
            <Button variant="outline" size="sm" onClick={() => setLeaveOpen(true)} className="h-8 gap-1.5">
              <RotateCw className="h-3.5 w-3.5" aria-hidden />
              Akhiri sesi
            </Button>
          </SessionStatusPanel>
        ) : phase === 'partner-left' ? (
          <SessionStatusPanel
            tone="warning"
            title="Partner keluar dari sesi"
            detail="Sesi berakhir karena peserta lain meninggalkan room. Kamu bisa mencari partner baru."
          >
            <Button variant="outline" size="sm" onClick={returnToLobby} className="h-8">
              Kembali ke lobby
            </Button>
            <Button
              size="sm"
              onClick={() => {
                returnToLobby()
                window.setTimeout(() => startSearch(), 0)
              }}
              className="h-8"
            >
              Cari partner baru
            </Button>
          </SessionStatusPanel>
        ) : (
          <div className="space-y-3">
            {mission ? <MissionPanel mission={mission} onOpen={() => setMissionOpen(true)} /> : <FreePlayPanel />}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl bg-card px-3.5 py-2.5 ring-1 ring-foreground/10">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                {MATCH_MODE_LABEL[matchMode]}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                {GAME_MODEL_LABEL[gameModel]}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                Sisa {formatClock(sessionSeconds)}
              </span>
              <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                <Users className="h-3 w-3" aria-hidden />
                {partners.length + 1} peserta
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-card px-3.5 py-2.5 ring-1 ring-foreground/10">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Siswa online
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {presence.users.slice(0, 6).map((user) => (
            <span
              key={user.uid}
              title={user.name}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[9px] uppercase text-muted-foreground"
            >
              {initialsOf(user.name)}
            </span>
          ))}
          {presence.users.length > 6 && (
            <span className="ml-0.5 font-mono text-[10px] text-muted-foreground">+{presence.users.length - 6}</span>
          )}
          {presence.users.length === 0 && (
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {!presenceEnabled
                ? 'Aktif setelah layanan real-time terhubung'
                : presence.error
                  ? 'Data online tidak tersedia'
                  : presence.onlineCount === null
                    ? 'Menghubungkan data online'
                    : 'Menunggu siswa lain'}
            </span>
          )}
        </div>
      </div>

      <DeviceSettingsDialog open={devicesOpen} onOpenChange={setDevicesOpen} media={media} />

      <MissionDialog
        open={missionDialogOpen && Boolean(mission)}
        mission={mission}
        partnerNames={partnerNames}
        onStart={() => {
          setMissionOpen(false)
          startSession()
        }}
      />

      <RoomChat
        open={chatOpen}
        onOpenChange={setChatOpen}
        messages={messages}
        partnerNames={partnerNames}
        onSend={sendMessage}
      />

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        partnerName={partnerNames[0] ?? ''}
      />

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Akhiri sesi?</DialogTitle>
            <DialogDescription>
              Sesi berakhir untuk semua peserta. XP diberikan setelah server mengonfirmasi sesi selesai.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>
              Tetap di sesi
            </Button>
            <Button variant="destructive" onClick={confirmLeave}>
              Akhiri sesi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

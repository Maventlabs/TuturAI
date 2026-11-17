'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  conversationOpening,
  type ConversationCorrection,
  type ConversationLevel,
  type ConversationMode,
  type ConversationSummary,
  type ConversationVocabularyNote,
} from '@tuturai/domain'
import { useMicrophone } from '@/hooks/use-microphone'
import type { OrbState } from '@/components/student/ai-tutor/voice-orb'
import { useAudioPlayback } from './use-audio-playback'
import { useHandsFree } from './use-hands-free'

export type ConversationPhase = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

export interface ConversationTurnView {
  id: string
  speaker: 'student' | 'tutor'
  transcript: string
  corrections: ConversationCorrection[]
  vocabularyNotes: ConversationVocabularyNote[]
  createdAt: number
}

export interface ConversationSessionView {
  id: string
  level: ConversationLevel
  mode: ConversationMode
  topicId: string | null
  topicLabel: string | null
  status: 'active' | 'ended'
  startedAt: number
  turnCount: number
  summary: ConversationSummary | null
}

export interface ConversationHistoryItem {
  id: string
  level: ConversationLevel
  topicLabel: string | null
  status: 'active' | 'ended'
  startedAt: number
  turnCount: number
}

function newTurnId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24)
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

async function readError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null)
  const message = payload?.error?.message
  const transcript = payload?.error?.details?.transcript
  return {
    message: typeof message === 'string' && message ? message : fallback,
    transcript: typeof transcript === 'string' ? transcript : null,
  }
}

export function useConversation(initialLevel: ConversationLevel) {
  const mic = useMicrophone({ liveLevels: false })
  const [level, setLevel] = useState<ConversationLevel>(initialLevel)
  const [mode, setMode] = useState<ConversationMode>('push-to-talk')
  const [session, setSession] = useState<ConversationSessionView | null>(null)
  const [turns, setTurns] = useState<ConversationTurnView[]>([])
  const [phase, setPhase] = useState<ConversationPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ConversationSummary | null>(null)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [speakingTurnId, setSpeakingTurnId] = useState<string | null>(null)
  const [speechErrors, setSpeechErrors] = useState<Record<string, boolean>>({})
  const [history, setHistory] = useState<ConversationHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const speechUrls = useRef(new Map<string, string>())
  const sentBlobRef = useRef<Blob | null>(null)
  const discardBlobRef = useRef(false)

  const resumeListening = useCallback(async () => {
    if (mic.status === 'recording') return
    mic.reset()
    const started = await mic.start()
    setPhase(started ? 'listening' : 'error')
  }, [mic])

  const handlePlaybackEnded = () => {
    setSpeakingTurnId(null)
    setPhase('idle')
    if (mode === 'hands-free' && session?.status === 'active') void resumeListening()
  }

  const playback = useAudioPlayback(handlePlaybackEnded)
  const { prime, play, stop: stopPlayback, levelRef: playbackLevelRef } = playback

  const ensureSpeechUrl = useCallback(async (turnId: string, text: string) => {
    const cached = speechUrls.current.get(turnId)
    if (cached) return cached

    try {
      const response = await fetch('/api/student/conversation/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!response.ok) throw new Error('TTS_FAILED')
      const blob = await response.blob()
      if (blob.size === 0) throw new Error('TTS_EMPTY')
      const url = URL.createObjectURL(blob)
      speechUrls.current.set(turnId, url)
      setSpeechErrors((previous) => {
        if (!(turnId in previous)) return previous
        const next = { ...previous }
        delete next[turnId]
        return next
      })
      return url
    } catch {
      setSpeechErrors((previous) => ({ ...previous, [turnId]: true }))
      return null
    }
  }, [])

  const speakTurn = useCallback(
    async (turnId: string, text: string) => {
      setSpeakingTurnId(turnId)
      setPhase('speaking')
      const url = await ensureSpeechUrl(turnId, text)
      if (!url) {
        setSpeakingTurnId(null)
        setPhase('idle')
        return
      }
      const started = await play(url)
      if (!started) {
        setSpeakingTurnId(null)
        setPhase('idle')
      }
    },
    [ensureSpeechUrl, play],
  )

  const sendAudio = useCallback(
    async (blob: Blob) => {
      if (!session) return

      setPhase('processing')
      setError(null)
      const turnId = newTurnId()

      try {
        const form = new FormData()
        form.append('sessionId', session.id)
        form.append('turnId', turnId)
        form.append('audio', blob, 'speech.webm')

        const response = await fetch('/api/student/conversation/turn', { method: 'POST', body: form })
        if (!response.ok) {
          const failure = await readError(response, 'Ucapanmu belum berhasil diproses. Coba lagi.')
          if (failure.transcript) {
            const keptTranscript = failure.transcript
            setTurns((previous) => [
              ...previous,
              {
                id: `${turnId}:student`,
                speaker: 'student',
                transcript: keptTranscript,
                corrections: [],
                vocabularyNotes: [],
                createdAt: Date.now(),
              },
            ])
          }
          throw new Error(failure.message)
        }

        const payload = await response.json()
        const studentTurn = payload.data.studentTurn as ConversationTurnView
        const tutorTurn = payload.data.tutorTurn as ConversationTurnView
        setTurns((previous) => [...previous, studentTurn, tutorTurn])
        await speakTurn(tutorTurn.id, tutorTurn.transcript)
      } catch (cause) {
        setPhase('error')
        setError(cause instanceof Error ? cause.message : 'Terjadi kesalahan. Coba lagi.')
      }
    },
    [session, speakTurn],
  )

  useEffect(() => {
    const blob = mic.audioBlob
    if (!blob || mic.status === 'recording') return
    if (sentBlobRef.current === blob) return
    sentBlobRef.current = blob
    if (discardBlobRef.current) {
      discardBlobRef.current = false
      return
    }
    void sendAudio(blob)
  }, [mic.audioBlob, mic.status, sendAudio])

  const startSession = useCallback(
    async (topicId: string | null) => {
      prime()
      setStarting(true)
      setError(null)
      setSummary(null)
      try {
        const response = await fetch('/api/student/conversation/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level, mode, topicId }),
        })
        if (!response.ok) {
          const failure = await readError(response, 'Sesi percakapan gagal dimulai.')
          throw new Error(failure.message)
        }
        const payload = await response.json()
        const next = payload.data.session as ConversationSessionView
        setSession(next)
        const opening: ConversationTurnView = {
          id: 'opening',
          speaker: 'tutor',
          transcript: conversationOpening(next.level, next.topicId),
          corrections: [],
          vocabularyNotes: [],
          createdAt: Date.now(),
        }
        setTurns([opening])
        void speakTurn(opening.id, opening.transcript)
      } catch (cause) {
        setPhase('error')
        setError(cause instanceof Error ? cause.message : 'Sesi percakapan gagal dimulai.')
      } finally {
        setStarting(false)
      }
    },
    [level, mode, prime, speakTurn],
  )

  const beginTurn = useCallback(async () => {
    if (!session || phase === 'processing') return
    prime()
    stopPlayback()
    setSpeakingTurnId(null)
    setError(null)
    mic.reset()
    const started = await mic.start()
    setPhase(started ? 'listening' : 'error')
  }, [mic, phase, prime, session, stopPlayback])

  const endTurn = useCallback(() => {
    if (mic.status === 'recording') mic.stop()
  }, [mic])

  const interrupt = useCallback(() => {
    stopPlayback()
    setSpeakingTurnId(null)
    setPhase('idle')
    if (mode === 'hands-free' && session?.status === 'active') void resumeListening()
  }, [mode, resumeListening, session, stopPlayback])

  const replay = useCallback(
    async (turnId: string, text: string) => {
      stopPlayback()
      await speakTurn(turnId, text)
    },
    [speakTurn, stopPlayback],
  )

  const changeMode = useCallback(
    async (next: ConversationMode) => {
      if (next === mode) return
      setMode(next)

      if (next === 'hands-free') {
        if (session?.status === 'active' && phase !== 'processing' && phase !== 'speaking') {
          await resumeListening()
        }
        return
      }

      if (mic.status === 'recording') {
        discardBlobRef.current = true
        mic.stop()
      }
      setPhase('idle')
    },
    [mic, mode, phase, resumeListening, session],
  )

  const endSession = useCallback(async (): Promise<ConversationSummary | null> => {
    if (!session) return null

    stopPlayback()
    setSpeakingTurnId(null)
    if (mic.status === 'recording') {
      discardBlobRef.current = true
      mic.stop()
    }
    setEnding(true)
    setError(null)

    try {
      const response = await fetch(`/api/student/conversation/session/${session.id}/end`, { method: 'POST' })
      if (!response.ok) {
        const failure = await readError(response, 'Ringkasan belajar gagal dibuat.')
        throw new Error(failure.message)
      }
      const payload = await response.json()
      const nextSummary = payload.data.summary as ConversationSummary
      setSummary(nextSummary)
      setSession((previous) => (previous ? { ...previous, status: 'ended', summary: nextSummary } : previous))
      setPhase('idle')
      return nextSummary
    } catch (cause) {
      setPhase('error')
      setError(cause instanceof Error ? cause.message : 'Ringkasan belajar gagal dibuat.')
      return null
    } finally {
      setEnding(false)
    }
  }, [mic, session, stopPlayback])

  const newSession = useCallback(() => {
    stopPlayback()
    if (mic.status === 'recording') {
      discardBlobRef.current = true
      mic.stop()
    }
    mic.reset()
    for (const url of speechUrls.current.values()) URL.revokeObjectURL(url)
    speechUrls.current.clear()
    setSession(null)
    setTurns([])
    setSummary(null)
    setError(null)
    setSpeechErrors({})
    setSpeakingTurnId(null)
    setPhase('idle')
  }, [mic, stopPlayback])

  const resumeSession = useCallback(
    async (sessionId: string): Promise<ConversationSummary | null> => {
      stopPlayback()
      setError(null)
      try {
        const response = await fetch(`/api/student/conversation/session/${sessionId}`)
        if (!response.ok) {
          const failure = await readError(response, 'Sesi percakapan tidak ditemukan.')
          throw new Error(failure.message)
        }
        const payload = await response.json()
        const next = payload.data.session as ConversationSessionView
        const nextTurns = (payload.data.turns as ConversationTurnView[]) ?? []
        setSession(next)
        setLevel(next.level)
        setMode(next.mode)
        setSummary(next.summary)
        setTurns(
          nextTurns.length > 0
            ? nextTurns
            : [
                {
                  id: 'opening',
                  speaker: 'tutor',
                  transcript: conversationOpening(next.level, next.topicId),
                  corrections: [],
                  vocabularyNotes: [],
                  createdAt: next.startedAt,
                },
              ],
        )
        setPhase('idle')
        return next.summary
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Sesi percakapan tidak ditemukan.')
        return null
      }
    },
    [stopPlayback],
  )

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch('/api/student/conversation/session')
      if (!response.ok) return
      const payload = await response.json()
      setHistory((payload.data.sessions as ConversationHistoryItem[]) ?? [])
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  const handsFreeActive = mode === 'hands-free' && phase === 'listening' && mic.status === 'recording'
  const { speaking: handsFreeSpeaking } = useHandsFree({
    active: handsFreeActive,
    volumeRef: mic.volumeRef,
    onUtteranceEnd: endTurn,
  })

  const orbState: OrbState =
    phase === 'listening'
      ? 'listening'
      : phase === 'processing'
        ? 'thinking'
        : phase === 'speaking'
          ? 'speaking'
          : phase === 'error'
            ? 'error'
            : 'idle'

  const getLevel = useCallback(() => {
    if (phase === 'listening') return mic.volumeRef.current
    if (phase === 'speaking') return playbackLevelRef.current
    return 0
  }, [mic.volumeRef, phase, playbackLevelRef])

  useEffect(() => {
    const urls = speechUrls.current
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  return {
    level,
    setLevel,
    mode,
    changeMode,
    session,
    turns,
    phase,
    error,
    summary,
    starting,
    ending,
    speakingTurnId,
    speechErrors,
    history,
    loadingHistory,
    micStatus: mic.status,
    micSeconds: mic.seconds,
    micError: mic.errorMessage,
    handsFreeSpeaking,
    orbState,
    getLevel,
    startSession,
    beginTurn,
    endTurn,
    interrupt,
    replay,
    endSession,
    newSession,
    resumeSession,
    loadHistory,
    clearError: () => setError(null),
  }
}

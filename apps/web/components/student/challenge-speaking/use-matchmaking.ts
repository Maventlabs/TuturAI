'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { demoPartners, pickDemoMission } from './demo-data'
import {
  SESSION_LIMIT_SECONDS,
  type ChatMessage,
  type GameModel,
  type MatchMode,
  type MediaPreference,
  type Mission,
  type Participant,
  type Phase,
} from './types'

interface UseMatchmakingOptions {
  studentName: string
  studentLevel: number
}

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function useMatchmaking({ studentName, studentLevel }: UseMatchmakingOptions) {
  const [gameModel, setGameModel] = useState<GameModel>('instruction')
  const [matchMode, setMatchMode] = useState<MatchMode>('1v1')
  const [mediaPreference, setMediaPreference] = useState<MediaPreference>('video')
  const [phase, setPhase] = useState<Phase>('lobby')
  const [partners, setPartners] = useState<Participant[]>([])
  const [mission, setMission] = useState<Mission | null>(null)
  const [searchSeconds, setSearchSeconds] = useState(0)
  const [sessionSeconds, setSessionSeconds] = useState(SESSION_LIMIT_SECONDS)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [endedAt, setEndedAt] = useState<number | null>(null)

  const timers = useRef<number[]>([])
  const sessionRef = useRef(SESSION_LIMIT_SECONDS)
  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }, [])

  const applySessionSeconds = useCallback((value: number) => {
    sessionRef.current = value
    setSessionSeconds(value)
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const resetSession = useCallback(() => {
    clearTimers()
    setPartners([])
    setMission(null)
    setMessages([])
    setRoomCode(null)
    setEndedAt(null)
    setSearchSeconds(0)
    applySessionSeconds(SESSION_LIMIT_SECONDS)
  }, [applySessionSeconds, clearTimers])

  const endSession = useCallback(() => {
    clearTimers()
    setEndedAt(Date.now())
    setPhase('ended')
  }, [clearTimers])

  const startSearch = useCallback(() => {
    resetSession()
    setPhase('searching')

    if (matchMode === 'private') {
      setRoomCode(generateCode())
      return
    }

    const found = demoPartners(studentLevel, matchMode)
    const matchTimer = window.setTimeout(() => {
      setPartners(found)
      setPhase('connecting')
      const connectTimer = window.setTimeout(() => {
        if (gameModel === 'instruction') {
          setMission(pickDemoMission(Date.now()))
          setPhase('mission')
          return
        }
        applySessionSeconds(SESSION_LIMIT_SECONDS)
        setPhase('active')
      }, 1800)
      timers.current.push(connectTimer)
    }, 3600)
    timers.current.push(matchTimer)
  }, [applySessionSeconds, gameModel, matchMode, resetSession, studentLevel])

  const joinWithCode = useCallback(
    (code: string) => {
      resetSession()
      setMatchMode('private')
      setRoomCode(code)
      setPhase('searching')
    },
    [resetSession],
  )

  const cancelSearch = useCallback(() => {
    resetSession()
    setPhase('lobby')
  }, [resetSession])

  const startSession = useCallback(() => {
    applySessionSeconds(SESSION_LIMIT_SECONDS)
    setPhase('active')
  }, [applySessionSeconds])

  const returnToLobby = useCallback(() => {
    resetSession()
    setPhase('lobby')
  }, [resetSession])

  const sendMessage = useCallback(
    (body: string) => {
      const text = body.trim()
      if (!text) return
      setMessages((previous) => [
        ...previous,
        {
          id: `msg-${Date.now()}-${previous.length}`,
          author: 'me',
          authorName: studentName,
          body: text,
          at: Date.now(),
        },
      ])
    },
    [studentName],
  )

  useEffect(() => {
    if (phase !== 'searching') return
    const tick = window.setInterval(() => setSearchSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(tick)
  }, [phase])

  useEffect(() => {
    if (phase !== 'active') return
    const tick = window.setInterval(() => {
      const next = Math.max(0, sessionRef.current - 1)
      applySessionSeconds(next)
      if (next === 0) endSession()
    }, 1000)
    return () => window.clearInterval(tick)
  }, [applySessionSeconds, endSession, phase])

  const previewState = useCallback(
    (target: Phase) => {
      clearTimers()
      const found = demoPartners(studentLevel, matchMode)
      const demoMission = pickDemoMission(0)
      const activeMission = gameModel === 'instruction' ? demoMission : null

      resetSession()

      if (target === 'lobby') {
        setPhase('lobby')
        return
      }
      if (target === 'searching') {
        setSearchSeconds(9)
        setPhase('searching')
        return
      }
      if (target === 'connecting') {
        setPartners(found)
        setPhase('connecting')
        return
      }
      if (target === 'mission') {
        setPartners(found)
        setMission(demoMission)
        setPhase('mission')
        return
      }
      if (target === 'active') {
        setPartners(found)
        setMission(activeMission)
        applySessionSeconds(212)
        setPhase('active')
        return
      }
      if (target === 'reconnecting') {
        setPartners(found)
        setMission(activeMission)
        applySessionSeconds(180)
        setPhase('reconnecting')
        return
      }
      if (target === 'partner-left') {
        setPartners(found)
        setMission(activeMission)
        applySessionSeconds(150)
        setPhase('partner-left')
        return
      }

      setPartners(found)
      setMission(activeMission)
      applySessionSeconds(120)
      setEndedAt(Date.now())
      setPhase('ended')
    },
    [applySessionSeconds, clearTimers, gameModel, matchMode, resetSession, studentLevel],
  )

  return {
    gameModel,
    setGameModel,
    matchMode,
    setMatchMode,
    mediaPreference,
    setMediaPreference,
    phase,
    partners,
    mission,
    searchSeconds,
    sessionSeconds,
    sessionElapsed: SESSION_LIMIT_SECONDS - sessionSeconds,
    messages,
    roomCode,
    endedAt,
    startSearch,
    joinWithCode,
    cancelSearch,
    startSession,
    endSession,
    returnToLobby,
    sendMessage,
    previewState,
  }
}

export type Matchmaking = ReturnType<typeof useMatchmaking>

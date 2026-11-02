'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Room, RoomEvent, Track, RemoteParticipant, LocalParticipant } from 'livekit-client'

export interface LiveKitState {
  connected: boolean
  connecting: boolean
  error: string | null
  participants: Map<string, RemoteParticipant>
  localParticipant: LocalParticipant | null
  isMuted: boolean
  isCameraOff: boolean
}

export function useLiveKit() {
  const [state, setState] = useState<LiveKitState>({
    connected: false,
    connecting: false,
    error: null,
    participants: new Map(),
    localParticipant: null,
    isMuted: false,
    isCameraOff: false,
  })
  const roomRef = useRef<Room | null>(null)

  const connect = useCallback(async (token: string, url: string, roomName: string) => {
    setState((s) => ({ ...s, connecting: true, error: null }))

    try {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      room.on(RoomEvent.Connected, () => {
        setState((s) => ({
          ...s,
          connected: true,
          connecting: false,
          localParticipant: room.localParticipant,
        }))
      })

      room.on(RoomEvent.Disconnected, () => {
        setState((s) => ({
          ...s,
          connected: false,
          connecting: false,
          participants: new Map(),
          localParticipant: null,
        }))
      })

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        setState((s) => {
          const newParticipants = new Map(s.participants)
          newParticipants.set(participant.identity, participant)
          return { ...s, participants: newParticipants }
        })
      })

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        setState((s) => {
          const newParticipants = new Map(s.participants)
          newParticipants.delete(participant.identity)
          return { ...s, participants: newParticipants }
        })
      })

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        // Track will be rendered via React refs
        setState((s) => ({ ...s, participants: new Map(s.participants) }))
      })

      await room.connect(url, token)
      roomRef.current = room

      // Enable camera and mic by default
      await room.localParticipant.enableCameraAndMicrophone()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to room'
      setState((s) => ({ ...s, connecting: false, error: message }))
    }
  }, [])

  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect()
      roomRef.current = null
    }
    setState({
      connected: false,
      connecting: false,
      error: null,
      participants: new Map(),
      localParticipant: null,
      isMuted: false,
      isCameraOff: false,
    })
  }, [])

  const toggleMute = useCallback(async () => {
    if (roomRef.current?.localParticipant) {
      const enabled = roomRef.current.localParticipant.isMicrophoneEnabled
      await roomRef.current.localParticipant.setMicrophoneEnabled(!enabled)
      setState((s) => ({ ...s, isMuted: enabled }))
    }
  }, [])

  const toggleCamera = useCallback(async () => {
    if (roomRef.current?.localParticipant) {
      const enabled = roomRef.current.localParticipant.isCameraEnabled
      await roomRef.current.localParticipant.setCameraEnabled(!enabled)
      setState((s) => ({ ...s, isCameraOff: enabled }))
    }
  }, [])

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect()
        roomRef.current = null
      }
    }
  }, [])

  return {
    ...state,
    connect,
    disconnect,
    toggleMute,
    toggleCamera,
    room: roomRef.current,
  }
}

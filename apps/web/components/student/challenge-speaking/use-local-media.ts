'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface MediaDeviceList {
  cameras: MediaDeviceInfo[]
  microphones: MediaDeviceInfo[]
  speakers: MediaDeviceInfo[]
}

const EMPTY_DEVICES: MediaDeviceList = { cameras: [], microphones: [], speakers: [] }

function describeMediaError(error: unknown, kind: 'camera' | 'microphone') {
  const label = kind === 'camera' ? 'Kamera' : 'Mikrofon'
  const name = error instanceof DOMException ? error.name : ''

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return `Izin ${label.toLowerCase()} ditolak. Aktifkan izin ${label.toLowerCase()} di pengaturan browser, lalu coba lagi.`
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return `${label} tidak ditemukan di perangkat ini.`
  }
  if (name === 'NotReadableError') {
    return `${label} sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.`
  }
  return `${label} tidak dapat diakses.`
}

export function useLocalMedia() {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const [cameraPending, setCameraPending] = useState(false)
  const [micPending, setMicPending] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceList>(EMPTY_DEVICES)
  const [cameraId, setCameraId] = useState<string | null>(null)
  const [micId, setMicId] = useState<string | null>(null)
  const [speakerId, setSpeakerId] = useState<string | null>(null)

  const cameraRef = useRef<MediaStream | null>(null)
  const micRef = useRef<MediaStream | null>(null)

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      setDevices({
        cameras: list.filter((device) => device.kind === 'videoinput'),
        microphones: list.filter((device) => device.kind === 'audioinput'),
        speakers: list.filter((device) => device.kind === 'audiooutput'),
      })
    } catch {
      setDevices(EMPTY_DEVICES)
    }
  }, [])

  const stopCamera = useCallback(() => {
    cameraRef.current?.getTracks().forEach((track) => track.stop())
    cameraRef.current = null
    setCameraStream(null)
  }, [])

  const stopMic = useCallback(() => {
    micRef.current?.getTracks().forEach((track) => track.stop())
    micRef.current = null
    setMicStream(null)
  }, [])

  const enableCamera = useCallback(
    async (deviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Browser ini tidak mendukung akses kamera.')
        return
      }
      setCameraPending(true)
      setCameraError(null)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' },
          audio: false,
        })
        cameraRef.current?.getTracks().forEach((track) => track.stop())
        cameraRef.current = stream
        setCameraStream(stream)
        const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId
        if (activeId) setCameraId(activeId)
        await refreshDevices()
      } catch (error) {
        setCameraError(describeMediaError(error, 'camera'))
      } finally {
        setCameraPending(false)
      }
    },
    [refreshDevices],
  )

  const enableMic = useCallback(
    async (deviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicError('Browser ini tidak mendukung akses mikrofon.')
        return
      }
      setMicPending(true)
      setMicError(null)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
          video: false,
        })
        micRef.current?.getTracks().forEach((track) => track.stop())
        micRef.current = stream
        setMicStream(stream)
        const activeId = stream.getAudioTracks()[0]?.getSettings().deviceId
        if (activeId) setMicId(activeId)
        await refreshDevices()
      } catch (error) {
        setMicError(describeMediaError(error, 'microphone'))
      } finally {
        setMicPending(false)
      }
    },
    [refreshDevices],
  )

  const toggleCamera = useCallback(() => {
    if (cameraRef.current) {
      stopCamera()
      return
    }
    void enableCamera(cameraId ?? undefined)
  }, [cameraId, enableCamera, stopCamera])

  const toggleMic = useCallback(() => {
    if (micRef.current) {
      stopMic()
      return
    }
    void enableMic(micId ?? undefined)
  }, [enableMic, micId, stopMic])

  const selectCamera = useCallback(
    (nextId: string) => {
      setCameraId(nextId)
      if (cameraRef.current) void enableCamera(nextId)
    },
    [enableCamera],
  )

  const selectMic = useCallback(
    (nextId: string) => {
      setMicId(nextId)
      if (micRef.current) void enableMic(nextId)
    },
    [enableMic],
  )

  const stopAll = useCallback(() => {
    stopCamera()
    stopMic()
  }, [stopCamera, stopMic])

  useEffect(() => {
    // Device labels only appear after permission is granted, so the list is
    // re-read on mount and whenever the browser reports a device change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshDevices()
    const handler = () => void refreshDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', handler)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handler)
  }, [refreshDevices])

  useEffect(() => {
    return () => {
      cameraRef.current?.getTracks().forEach((track) => track.stop())
      micRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return {
    cameraStream,
    micStream,
    cameraOn: Boolean(cameraStream),
    micOn: Boolean(micStream),
    cameraPending,
    micPending,
    cameraError,
    micError,
    devices,
    cameraId,
    micId,
    speakerId,
    setSpeakerId,
    enableCamera,
    enableMic,
    stopCamera,
    stopMic,
    stopAll,
    toggleCamera,
    toggleMic,
    selectCamera,
    selectMic,
    clearCameraError: () => setCameraError(null),
    clearMicError: () => setMicError(null),
  }
}

export type LocalMedia = ReturnType<typeof useLocalMedia>

'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Send, Mic, Square, Bot, Sparkles, Volume2 } from 'lucide-react'
import type { Assessment, QuestionBankItem } from '@tuturai/domain'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Waveform } from '@/components/dashboard/waveform'
import { useMicrophone } from '@/hooks/use-microphone'
import { cn } from '@/lib/utils'
import { CompletionDialog } from '@/components/dashboard/completion-dialog'
import { deleteOfflineRecord, enqueuePendingMutation, putOfflineRecord, OFFLINE_STORES } from '@/lib/offline/offline-db'

interface Msg {
  id: string
  role: 'ai' | 'user'
  text: string
}

function scenarioLabel(item: QuestionBankItem) {
  return item.word ?? item.tags[0] ?? item.prompt.slice(0, 32)
}

export default function PercakapanPage() {
  const [items, setItems] = useState<QuestionBankItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [providerMessage, setProviderMessage] = useState<string | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [textAssessment, setTextAssessment] = useState<{ score: number; feedback: string } | null>(null)
  const [showCompletion, setShowCompletion] = useState(false)
  const [assessing, setAssessing] = useState(false)
  const [classrooms, setClassrooms] = useState<Array<{ id: string; name: string }>>([])
  const [classroomId, setClassroomId] = useState<string | null>(null)
  const [playingTutorVoice, setPlayingTutorVoice] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const submittedAudio = useRef<Blob | null>(null)
  const assessingRef = useRef(false)
  const tutorAudio = useRef<HTMLAudioElement | null>(null)
  const tutorAudioUrl = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const mic = useMicrophone()
  const recording = mic.status === 'recording'
  const selected = items.find((item) => item.id === selectedId) ?? null

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/classrooms', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('CLASSROOM_LOAD_FAILED')
        return response.json() as Promise<{ data?: Array<{ id: string; name: string }> }>
      })
      .then((payload) => {
        const nextClassrooms = payload.data ?? []
        setClassrooms(nextClassrooms)
        setClassroomId(nextClassrooms[0]?.id ?? null)
      })
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) setClassroomId(null)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => () => {
    tutorAudio.current?.pause()
    if (tutorAudioUrl.current) URL.revokeObjectURL(tutorAudioUrl.current)
  }, [])

  useEffect(() => {
    if (!mic.audioBlob || mic.audioBlob === submittedAudio.current || !selected || recording || assessingRef.current) return
    submittedAudio.current = mic.audioBlob
    const controller = new AbortController()
    const submit = async () => {
      assessingRef.current = true
      setAssessing(true)
      setProviderMessage('Menganalisis jawaban suara...')
      const form = new FormData()
      const assessmentSessionId = crypto.randomUUID()
      form.set('sessionId', assessmentSessionId)
      form.set('mode', 'conversation')
      form.set('expectedText', selected.prompt)
      form.set('audio', mic.audioBlob as Blob, 'conversation.webm')
      try {
        await putOfflineRecord(OFFLINE_STORES.audioQueue, assessmentSessionId, mic.audioBlob)
        const response = await fetch('/api/student/assessment', { method: 'POST', body: form, signal: controller.signal })
        const payload = await response.json() as { data?: Assessment; error?: { message?: string } }
        if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? 'Penilaian percakapan gagal.')
         await deleteOfflineRecord(OFFLINE_STORES.audioQueue, assessmentSessionId)
          setAssessment(payload.data)
         setShowCompletion(true)
         setProviderMessage(`Skor percakapan: ${payload.data.overall}/100. ${payload.data.feedback}`)
      } catch (cause) {
        if (!controller.signal.aborted) {
          if (cause instanceof TypeError || !navigator.onLine) {
            await enqueuePendingMutation({
              operation: 'assessment-audio',
              payload: { sessionId: assessmentSessionId, mode: 'conversation', expectedText: selected.prompt, audio: mic.audioBlob },
              idempotencyKey: assessmentSessionId,
            })
            setProviderMessage('Audio disimpan di antrean offline dan akan dinilai saat koneksi kembali.')
          } else {
            setProviderMessage(cause instanceof Error ? cause.message : 'Penilaian percakapan gagal. Coba lagi.')
          }
        }
      } finally {
        assessingRef.current = false
        if (!controller.signal.aborted) setAssessing(false)
      }
    }
    void submit()
    return () => controller.abort()
  }, [mic.audioBlob, selected, recording])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/student/question-bank?type=conversation&limit=20', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('QUESTION_BANK_LOAD_FAILED')
        return response.json() as Promise<{ data?: QuestionBankItem[] }>
      })
      .then((payload) => {
        const data = payload.data ?? []
        const preferredId = new URLSearchParams(window.location.search).get('questionId')
        const preferred = data.find((item) => item.id === preferredId) ?? data[0]
        setItems(data)
        setSelectedId(preferred?.id ?? null)
        if (preferred) setMessages([{ id: preferred.id, role: 'ai', text: preferred.prompt }])
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError('Skenario percakapan belum dapat dimuat. Coba lagi nanti.')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, providerMessage])

  async function toggleMic() {
    if (recording) {
      mic.stop()
      setProviderMessage('Memproses jawaban suara dengan provider AI...')
      return
    }
    mic.reset()
    setAssessment(null)
    setTextAssessment(null)
    setShowCompletion(false)
    submittedAudio.current = null
    await mic.start()
  }

  async function send() {
    const text = input.trim()
    if (!text || !selected) return
    const attemptId = crypto.randomUUID()
    setMessages((current) => [...current, { id: attemptId, role: 'user', text }])
    setInput('')
    setProviderMessage('Menilai jawaban teks dengan rubric percakapan...')
    try {
      const response = await fetch('/api/student/conversation-text', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': attemptId },
        body: JSON.stringify({ questionId: selected.id, attemptId, sessionId, answer: text }),
      })
      const payload = await response.json() as { data?: { score: number; feedback: string }; error?: { message?: string } }
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? 'Penilaian jawaban teks gagal.')
      setTextAssessment(payload.data)
      setShowCompletion(true)
      setProviderMessage(`Skor jawaban teks: ${payload.data.score}/100. ${payload.data.feedback}`)
    } catch (cause) {
      if (cause instanceof TypeError || !navigator.onLine) {
        await enqueuePendingMutation({ operation: 'conversation-text', payload: { questionId: selected.id, attemptId, sessionId, answer: text }, idempotencyKey: attemptId })
        setProviderMessage('Jawaban disimpan di antrean offline dan akan dinilai saat koneksi kembali.')
      } else {
        setProviderMessage(cause instanceof Error ? cause.message : 'Penilaian jawaban teks gagal. Coba lagi.')
      }
    }
  }

  function selectScenario(item: QuestionBankItem) {
    setSelectedId(item.id)
    setMessages([{ id: item.id, role: 'ai', text: item.prompt }])
    setProviderMessage(null)
     setAssessment(null)
     setTextAssessment(null)
     setShowCompletion(false)
    mic.reset()
    submittedAudio.current = null
  }

  async function playTutorVoice(text: string) {
    if (!classroomId) {
      setProviderMessage('Belum ada classroom aktif untuk audio tutor.')
      return
    }
    setPlayingTutorVoice(true)
    setProviderMessage('Menyiapkan audio tutor...')
    try {
      const response = await fetch(`/api/classrooms/${encodeURIComponent(classroomId)}/voice`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(payload?.error?.message ?? 'Audio tutor belum tersedia.')
      }
      const blob = await response.blob()
      if (tutorAudioUrl.current) URL.revokeObjectURL(tutorAudioUrl.current)
      tutorAudioUrl.current = URL.createObjectURL(blob)
      tutorAudio.current?.pause()
      const audio = new Audio(tutorAudioUrl.current)
      tutorAudio.current = audio
      audio.onended = () => setPlayingTutorVoice(false)
      await audio.play()
      setProviderMessage(null)
    } catch (cause) {
      setProviderMessage(cause instanceof Error ? cause.message : 'Audio tutor gagal diputar. Coba lagi.')
    } finally {
      setPlayingTutorVoice(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Conversation"
        description="Latih percakapan natural dengan skenario yang tersedia di bank soal TuturAI."
      />

      {loading && <Card className="p-6 text-sm text-muted-foreground">Memuat skenario percakapan...</Card>}
      {error && <Card className="border-destructive/30 p-6 text-sm text-destructive">{error}</Card>}
      {!loading && !error && items.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">Belum ada skenario percakapan yang dipublikasikan.</Card>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Pilih skenario percakapan">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => selectScenario(item)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  selectedId === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {scenarioLabel(item)}
              </button>
            ))}
          </div>

          <Card className="flex h-[60vh] flex-col overflow-hidden border-border">
            <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-5 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">AI Tutor</p>
                <p className="text-xs text-muted-foreground">Skenario: {selected && scenarioLabel(selected)}</p>
              </div>
               <div className="flex items-center gap-2">
                 {classrooms.length > 1 && (
                   <label className="sr-only" htmlFor="conversation-classroom">Classroom aktif</label>
                 )}
                 {classrooms.length > 1 && (
                   <select
                     id="conversation-classroom"
                     aria-label="Pilih classroom aktif untuk audio tutor"
                     value={classroomId ?? ''}
                     onChange={(event) => setClassroomId(event.target.value)}
                     className="h-8 max-w-36 rounded-md border border-border bg-background px-2 text-xs"
                   >
                     {classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
                   </select>
                 )}
                 <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" /> Bank soal</Badge>
               </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className={cn('text-xs font-semibold', message.role === 'ai' ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-accent')}>
                      {message.role === 'ai' ? <Bot className="h-4 w-4" /> : 'AP'}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn('max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed', message.role === 'ai' ? 'rounded-tl-sm bg-muted text-foreground' : 'rounded-tr-sm bg-primary text-primary-foreground')}>
                    {message.text}
                    {message.role === 'ai' && (
                      <button onClick={() => void playTutorVoice(message.text)} disabled={playingTutorVoice} className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-wait disabled:opacity-60" aria-label="Putar audio">
                        <Volume2 className="h-3 w-3" /> {playingTutorVoice ? 'Menyiapkan...' : 'Dengarkan'}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
               {providerMessage && <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">{providerMessage}</p>}
               {assessment && <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">Transcript: {assessment.transcript} · Overall: {assessment.overall}/100</p>}
            </div>

            <div className="border-t border-border p-3">
              {recording && <div className="mb-2 flex items-center gap-3 rounded-full bg-rose-500/10 px-4 py-1.5"><span className="flex items-center gap-1.5 text-xs font-semibold text-rose-500"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />{String(Math.floor(mic.seconds / 60)).padStart(2, '0')}:{String(mic.seconds % 60).padStart(2, '0')}</span><Waveform active levels={mic.levels} bars={20} className="h-8 flex-1" /></div>}
              {mic.errorMessage && !recording && <p className="mb-2 px-2 text-xs text-destructive">{mic.errorMessage}</p>}
              <div className="flex items-center gap-2">
                <Button variant={recording ? 'default' : 'outline'} size="icon" className={cn('shrink-0', recording && 'bg-rose-500 hover:bg-rose-600')} onClick={toggleMic} disabled={mic.status === 'requesting'} aria-label={recording ? 'Hentikan rekaman' : 'Rekam suara'}>{recording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}</Button>
                <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && send()} placeholder="Ketik jawabanmu dalam bahasa Inggris..." aria-label="Jawaban percakapan" className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none ring-ring focus-visible:ring-2" />
                <Button size="icon" className="shrink-0" onClick={send} disabled={!input.trim()} aria-label="Kirim"><Send className="h-4 w-4" /></Button>
              </div>
            </div>
           </Card>
           <CompletionDialog
             open={showCompletion && (assessment !== null || textAssessment !== null)}
             title={(assessment?.overall ?? textAssessment?.score ?? 0) >= 80 ? 'Percakapan mantap!' : 'Percakapan selesai'}
             message="Hasil percakapan sudah dikonfirmasi tersimpan oleh server."
             score={`${assessment?.overall ?? textAssessment?.score ?? 0}/100`}
             detail={assessment?.feedback ?? textAssessment?.feedback ?? 'Hasil analisis tersedia di sesi ini.'}
             onClose={() => setShowCompletion(false)}
           />
         </>
      )}
    </div>
  )
}

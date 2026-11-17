'use client'

import { useEffect, useId, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface GradeInputProps {
  submissionId: string
  initialScore: number | null
  /** Current feedback text, saved together with the grade when provided. */
  feedback?: string
  disabled?: boolean
  compact?: boolean
  showSaveButton?: boolean
  onSaved?: (score: number | null) => void
}

export function GradeInput({
  submissionId,
  initialScore,
  feedback,
  disabled = false,
  compact = false,
  showSaveButton = false,
  onSaved,
}: GradeInputProps) {
  const [value, setValue] = useState(initialScore === null ? '' : String(initialScore))
  const [savedScore, setSavedScore] = useState<number | null>(initialScore)
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()

  useEffect(() => {
    setValue(initialScore === null ? '' : String(initialScore))
    setSavedScore(initialScore)
    setState('idle')
    setError(null)
  }, [initialScore, submissionId])

  async function commit(raw: string) {
    const trimmed = raw.trim()
    const next = trimmed === '' ? null : Number(trimmed)
    if (next !== null && (!Number.isInteger(next) || next < 1 || next > 100)) {
      setState('error')
      setError('Nilai harus bilangan bulat 1–100')
      return
    }
    if (next === savedScore) {
      setState('idle')
      setError(null)
      return
    }

    setState('saving')
    setError(null)
    try {
      const response = await fetch(`/api/submissions/${submissionId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: next, ...(feedback === undefined ? {} : { feedback }) }),
      })
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Gagal menyimpan nilai')
      setSavedScore(next)
      setState('saved')
      onSaved?.(next)
    } catch (cause) {
      setState('error')
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan nilai')
    }
  }

  const invalid = state === 'error'

  return (
    <div className={cn(compact ? 'flex items-center justify-end gap-1.5' : 'mt-2 space-y-2')}>
      {!compact && (
        <label htmlFor={inputId} className="block text-xs font-medium text-muted-foreground">
          Nilai 1–100
        </label>
      )}
      <div className={cn('flex items-center gap-2', compact && 'justify-end')}>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          step={1}
          value={value}
          disabled={disabled || state === 'saving'}
          aria-label={compact ? 'Nilai guru 1 sampai 100' : undefined}
          aria-invalid={invalid || undefined}
          title={error ?? undefined}
          onChange={(event) => {
            setValue(event.target.value)
            if (state === 'error') {
              setState('idle')
              setError(null)
            }
          }}
          onBlur={(event) => void commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void commit(event.currentTarget.value)
            }
          }}
          placeholder="–"
          className={cn(
            'rounded-md border bg-card text-center font-mono tabular-nums text-foreground outline-none transition-colors',
            'placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-60',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            compact ? 'h-8 w-14 text-sm' : 'h-10 w-24 text-base font-semibold',
            invalid ? 'border-destructive' : 'border-border',
          )}
        />
        {state === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />}
        {state === 'saved' && <Check className="h-3.5 w-3.5 text-success" aria-hidden />}
        {showSaveButton && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || state === 'saving'}
            onClick={() => void commit(value)}
          >
            Simpan nilai
          </Button>
        )}
      </div>
      {!compact && (
        <p className={cn('text-xs', invalid ? 'text-destructive' : 'text-muted-foreground')} role={invalid ? 'alert' : undefined}>
          {error ?? 'Nilai ini yang masuk ke buku nilai dan ekspor Excel.'}
        </p>
      )}
      {compact && error && <span className="sr-only" role="alert">{error}</span>}
    </div>
  )
}

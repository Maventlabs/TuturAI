'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FileDrop({
  accept,
  multiple = false,
  onFiles,
  label,
  hint,
}: {
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  label: string
  hint: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    onFiles(Array.from(list))
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        handleFiles(event.dataTransfer.files)
      }}
      className={cn(
        'rounded-lg border border-dashed transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30 hover:border-primary/40',
      )}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground">
          <Upload className="size-3.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-foreground">{label}</span>
          <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
            {hint}
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}

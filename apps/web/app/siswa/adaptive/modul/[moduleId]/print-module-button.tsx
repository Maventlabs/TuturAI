'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintModuleButton() {
  return (
    <Button onClick={() => window.print()} size="sm">
      <Printer data-icon="inline-start" /> Cetak / simpan PDF
    </Button>
  )
}

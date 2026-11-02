'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Page error:', error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="max-w-md p-6 text-center">
        <h2 className="font-heading text-lg font-bold text-foreground">
          Halaman gagal dimuat
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Terjadi kesalahan saat memuat halaman. Coba muat ulang.
        </p>
        <Button onClick={reset} className="mt-4">
          Muat Ulang
        </Button>
      </Card>
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { captureClientException } from '@/lib/analytics/client'

// Shared body of the route-level error.tsx boundaries: a server error (database unreachable,
// say) shows this inside the page's own layout instead of a blank 500.
export function ErrorFallback({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureClientException(error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-16 text-center gap-4">
      <h1 className="font-bold text-2xl text-charcoal">Une erreur est survenue</h1>
      <p className="text-charcoal/50 max-w-md">
        Le service est momentanément indisponible. Réessayez dans quelques instants.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-accent-500 hover:bg-accent-600 text-white px-5 py-2.5 font-semibold text-sm transition-colors"
        >
          Réessayer
        </button>
        <Link href="/" className="rounded-xl border border-charcoal/[0.14] px-5 py-2.5 font-semibold text-sm text-charcoal/80 hover:bg-charcoal/[0.03] transition-colors">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  )
}

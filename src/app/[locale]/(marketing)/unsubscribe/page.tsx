import type { Metadata } from 'next'
import { Suspense } from 'react'
import { UnsubscribeClient } from './UnsubscribeClient'
import { CONTACT_EMAIL } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Désinscription',
  robots: { index: false, follow: false },
}

export default function UnsubscribePage() {
  return (
    <section className="min-h-[60vh] flex items-center justify-center px-4 sm:px-6 py-24">
      <Suspense fallback={null}>
        <UnsubscribeClient contactEmail={CONTACT_EMAIL} />
      </Suspense>
    </section>
  )
}

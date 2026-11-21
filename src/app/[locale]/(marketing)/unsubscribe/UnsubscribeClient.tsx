'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

type State = 'working' | 'unsubscribed' | 'resubscribed' | 'invalid' | 'error'

async function callUnsubscribe(u: string, t: string, action: 'unsubscribe' | 'resubscribe'): Promise<State> {
  try {
    const res = await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ u, t, action }),
    })
    if (res.status === 400) return 'invalid'
    if (!res.ok) return 'error'
    return action === 'resubscribe' ? 'resubscribed' : 'unsubscribed'
  } catch {
    return 'error'
  }
}

// Opting out happens as soon as the page opens — one click from the email, as it should be.
// It runs here in the browser rather than on the server render because mail security scanners
// fetch every link in an email without executing scripts: this way only a real visit counts.
export function UnsubscribeClient({ contactEmail }: { contactEmail: string }) {
  const params = useSearchParams()
  const u = params.get('u') ?? ''
  const t = params.get('t') ?? ''
  const [state, setState] = useState<State>(u && t ? 'working' : 'invalid')
  const [busy, setBusy] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (!u || !t || started.current) return
    started.current = true
    callUnsubscribe(u, t, 'unsubscribe').then(setState)
  }, [u, t])

  async function toggle(action: 'unsubscribe' | 'resubscribe') {
    setBusy(true)
    setState(await callUnsubscribe(u, t, action))
    setBusy(false)
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-accent-100 bg-white p-8 text-center shadow-sm">
      {state === 'working' && (
        <>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent-400" />
          <p className="mt-4 text-charcoal/60">Désinscription en cours…</p>
        </>
      )}

      {state === 'unsubscribed' && (
        <>
          <CheckCircle className="mx-auto h-9 w-9 text-accent-500" strokeWidth={1.75} />
          <h1 className="mt-4 font-display text-2xl font-bold text-charcoal">C’est fait</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-charcoal/65">
            Vous ne recevrez plus nos emails de conseils et de relance. Les emails liés à votre compte
            (reçus, mot de passe) continuent d’arriver.
          </p>
          <button
            onClick={() => toggle('resubscribe')}
            disabled={busy}
            className="mt-6 text-sm font-medium text-accent-600 underline hover:text-accent-700 disabled:opacity-50"
          >
            {busy ? 'Un instant…' : 'Annuler, je veux continuer à les recevoir'}
          </button>
        </>
      )}

      {state === 'resubscribed' && (
        <>
          <CheckCircle className="mx-auto h-9 w-9 text-accent-500" strokeWidth={1.75} />
          <h1 className="mt-4 font-display text-2xl font-bold text-charcoal">Vous êtes réinscrit</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-charcoal/65">
            Vous recevrez de nouveau nos emails de conseils et de relance.
          </p>
          <button
            onClick={() => toggle('unsubscribe')}
            disabled={busy}
            className="mt-6 text-sm font-medium text-charcoal/45 underline hover:text-charcoal/70 disabled:opacity-50"
          >
            {busy ? 'Un instant…' : 'Me désinscrire'}
          </button>
        </>
      )}

      {(state === 'invalid' || state === 'error') && (
        <>
          <AlertCircle className="mx-auto h-9 w-9 text-amber-500" strokeWidth={1.75} />
          <h1 className="mt-4 font-display text-2xl font-bold text-charcoal">
            {state === 'invalid' ? 'Lien invalide' : 'Une erreur est survenue'}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-charcoal/65">
            {state === 'invalid'
              ? 'Ce lien de désinscription est incomplet ou abîmé. Écrivez-nous et nous vous désinscrirons à la main :'
              : 'La désinscription n’a pas pu être enregistrée. Réessayez, ou écrivez-nous :'}
            {' '}
            <a href={`mailto:${contactEmail}?subject=${encodeURIComponent('Désinscription')}`} className="text-accent-600 underline">
              {contactEmail}
            </a>
          </p>
          {state === 'error' && (
            <button
              onClick={() => toggle('unsubscribe')}
              disabled={busy}
              className="mt-6 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
            >
              {busy ? 'Un instant…' : 'Réessayer'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

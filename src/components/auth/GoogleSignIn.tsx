'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { signIn } from 'next-auth/react'
import { GoogleIcon } from '@/components/GoogleIcon'

// Whether Google sign-in is configured is only known on the server (GOOGLE_CLIENT_ID/SECRET);
// the auth layout passes it down to the client sign-in and sign-up pages through this context.
const GoogleSignInContext = createContext(false)

export function GoogleSignInProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <GoogleSignInContext.Provider value={enabled}>{children}</GoogleSignInContext.Provider>
}

// The Google button and the "ou avec e-mail" divider below it; nothing when Google isn't set up.
export function GoogleSignInSection({ label, note }: { label: string; note?: ReactNode }) {
  const enabled = useContext(GoogleSignInContext)
  if (!enabled) return null

  return (
    <>
      <button
        type="button"
        onClick={() => signIn('google', { callbackUrl: '/app' })}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-charcoal/[0.14] hover:border-charcoal/[0.28] hover:bg-charcoal/[0.02] px-4 py-2.5 text-sm font-semibold text-charcoal/85 transition-colors"
      >
        <GoogleIcon className="w-4 h-4" />
        {label}
      </button>
      {note}

      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-charcoal/[0.08]" />
        <span className="text-[11px] uppercase tracking-widest text-charcoal/35">ou avec e-mail</span>
        <div className="h-px flex-1 bg-charcoal/[0.08]" />
      </div>
    </>
  )
}

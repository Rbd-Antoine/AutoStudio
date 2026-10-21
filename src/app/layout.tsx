import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { getLocale } from 'next-intl/server'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Providers } from '@/components/Providers'
import { SITE_URL, CALENDLY_URL } from '@/lib/site-config'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AutoStudio — Des photos de voitures dignes d\'un showroom, en secondes',
    template: '%s | AutoStudio',
  },
  description:
    "AutoStudio remplace l'arrière-plan des photos de votre stock véhicules par un décor professionnel en quelques secondes, et en tire des vidéos prêtes à publier pour vos annonces et vos réseaux.",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  // Meta Business domain verification — rendered server-side via Next's Metadata API,
  // so it's present in the initial HTML <head> rather than injected by client JS
  // (Meta explicitly requires the former; the latter fails verification). The token is
  // tied to one domain, so it comes from the environment of the deployment serving it.
  ...(process.env.FACEBOOK_DOMAIN_VERIFICATION
    ? { verification: { other: { 'facebook-domain-verification': process.env.FACEBOOK_DOMAIN_VERIFICATION } } }
    : {}),
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <style>{`:root { --font-display: var(--font-inter); }`}</style>
        {/* Warms up the TCP+TLS handshake ahead of time for third-party origins the site
            actually loads (PostHog, Meta Pixel, Calendly) — each is still deferred/lazy on
            its own terms, this just means the connection is already half-open by the time
            they're needed instead of paying that cost cold. */}
        {process.env.NEXT_PUBLIC_POSTHOG_KEY && (
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'} />
        )}
        {process.env.NEXT_PUBLIC_META_PIXEL_ID && <link rel="preconnect" href="https://connect.facebook.net" />}
        {CALENDLY_URL && <link rel="preconnect" href="https://calendly.com" />}
      </head>
      <body className="bg-offwhite text-charcoal antialiased">
        <Providers>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  )
}

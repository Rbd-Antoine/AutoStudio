import NextAuth, { type NextAuthRequest } from 'next-auth'
import { authConfig } from './auth.config'
import createNextIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { DEV_AUTH_BYPASS_ENABLED } from './lib/dev-auth-flag'
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server'

const { auth } = NextAuth(authConfig)
const intlMiddleware = createNextIntlMiddleware(routing)

// The app and auth pages live outside the [locale] segment, but next-intl's <Link> prefixes
// the active locale, so a sign-up CTA clicked on /en pointed to /en/signup — a 404. Requests
// like that are redirected to the unprefixed page.
const LOCALE_PREFIXED_APP_PAGE = new RegExp(
  `^/(?:${routing.locales.join('|')})(/(?:app|signin|signup|forgot-password|reset-password|verify|check-email|auth)(?:/.*)?)$`,
)

// Editions that existed once but served untranslated French: any address under them is sent
// for good to the same page without the prefix, so old links and indexed URLs keep working.
const RETIRED_LOCALES = /^\/(?:en|de|es|pt)(?=\/|$)/

// Pages that authenticated users should not see (redirect them to /app)
const GUEST_ONLY = ['/signin', '/signup', '/forgot-password', '/reset-password', '/verify']
// Pages that require auth but don't redirect verified users away
const AUTH_ONLY  = ['/check-email']

const authMiddleware = auth(function middleware(req: NextAuthRequest) {
  const { pathname } = req.nextUrl

  // Auth pages: redirect if already logged in, otherwise pass through as-is.
  if (GUEST_ONLY.includes(pathname)) {
    if (req.auth?.user) return Response.redirect(new URL('/app', req.url))
    return // not authenticated → let Next.js render the page normally
  }

  // /check-email: requires auth but stays accessible regardless of verification status
  if (AUTH_ONLY.includes(pathname)) {
    if (!req.auth?.user) return Response.redirect(new URL('/signin', req.url))
    return
  }

  // /app/* requires a session — except locally with DEV_AUTH_BYPASS=true, so the editor can
  // be tested without signing in (see src/lib/dev-auth.ts, used by the /app pages).
  if (!req.auth?.user && !DEV_AUTH_BYPASS_ENABLED) {
    const signInUrl = new URL('/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return Response.redirect(signInUrl)
  }
})

// Marketing routes never need a session check, so they skip `auth()`'s JWT decrypt/verify
// entirely (that cost was previously paid on every anonymous mobile pageview) and go
// straight to locale routing.
export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl
  if (RETIRED_LOCALES.test(pathname)) {
    const url = req.nextUrl.clone()
    url.pathname = pathname.replace(RETIRED_LOCALES, '') || '/'
    return NextResponse.redirect(url, 308)
  }
  const unprefixed = pathname.match(LOCALE_PREFIXED_APP_PAGE)
  if (unprefixed) {
    const url = req.nextUrl.clone()
    url.pathname = unprefixed[1]
    return NextResponse.redirect(url)
  }
  const needsAuth = pathname.startsWith('/app') || GUEST_ONLY.includes(pathname) || AUTH_ONLY.includes(pathname)
  // auth()'s middleware overload is typed as a route handler (second argument: route context),
  // but in middleware it receives the fetch event, which is what it uses at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (needsAuth) return (authMiddleware as any)(req, event)
  return intlMiddleware(req)
}

export const config = {
  matcher: [
    // Protect the whole app shell
    '/app/:path*',
    // Redirect authenticated users away from auth pages
    '/signin',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/verify',
    // Auth-required pages (not guest-only)
    '/check-email',
    // Apply next-intl to marketing routes (exclude api, assets, auth pages)
    '/((?!api|_next/static|_next/image|app|signin|signup|verify|forgot-password|reset-password|check-email|auth|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|html|mp4|webm|mov|ogg)).*)',
  ],
}

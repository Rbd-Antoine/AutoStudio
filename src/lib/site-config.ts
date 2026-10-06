// Everything that depends on where the site runs or who operates it, so a new domain or a new
// contact address is an environment change, not a code hunt. SITE_URL and EMAIL_FROM are
// server-only; the NEXT_PUBLIC_* values are inlined at build time and safe in client code.

// Public origin used for SEO (metadataBase, sitemap, canonical URLs) and every link in emails.
// On Vercel, VERCEL_PROJECT_PRODUCTION_URL is set automatically to the project's production
// domain — the custom domain once one is attached, the *.vercel.app one until then.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  process.env.NEXTAUTH_URL ||
  'http://localhost:3000'
).replace(/\/+$/, '')

// Resend only sends from a domain verified in its dashboard. Its shared onboarding@resend.dev
// sender works without one, but only delivers to the Resend account owner's own address.
export const EMAIL_FROM = process.env.EMAIL_FROM || 'CarGlow <onboarding@resend.dev>'

// Shown on the legal pages, used as the reply-to of every email, and the contact form's inbox.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'carglow.rendus@gmail.com'

// Booking calendar embedded on the landing page; the section is hidden while it is unset.
export const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || ''

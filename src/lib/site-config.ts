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
export const EMAIL_FROM = process.env.EMAIL_FROM || 'AutoStudio <onboarding@resend.dev>'

// Shown on the legal pages, used as the reply-to of every email, and the contact form's inbox.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'carglow.rendus@gmail.com'

// Booking calendar embedded on the landing page; the section is hidden while it is unset.
export const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || ''

// Server-only. The Google provider and its "Continuer avec Google" buttons exist only once the
// OAuth client is configured, rather than offering a button that fails on click.
export const GOOGLE_SIGN_IN_ENABLED = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET

// Publisher identity, shown on the legal notice (/legal/mentions) and in the terms. Required
// before taking payments: the owner's legal name, the NIF (Portuguese tax number), the VAT
// number or the exemption that applies, and the publication director. Empty fields are not
// displayed.
export const LEGAL_ENTITY = {
  tradeName:           'AutoStudio',
  ownerName:           '', // nom et prénom de l'entrepreneur individuel
  taxId:               '', // NIF
  vat:                 '', // n° de TVA intracommunautaire, ou mention d'exonération (art. 53.º CIVA)
  publicationDirector: '',
  address:             ['201 Rua Saraiva de Carvalho', '1250-247 Lisbonne', 'Portugal'],
}

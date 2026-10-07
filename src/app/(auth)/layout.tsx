import Link from 'next/link'
import Image from 'next/image'
import { Quote } from 'lucide-react'
import { AuthVisualCarousel } from '@/components/AuthVisualCarousel'
import { TestimonialAvatar } from '@/components/TestimonialAvatar'
import { getPublicTestimonials } from '@/lib/reviews'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const testimonials = await getPublicTestimonials()
  // Picks the testimonial that isn't the homepage's default first one — a visitor who just
  // scrolled the homepage and clicks through to sign up would otherwise see the exact same
  // quote again immediately.
  const authTestimonial = testimonials[1] ?? testimonials[0]

  return (
    <div className="min-h-screen bg-offwhite text-charcoal flex">
      {/* ── Form column ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Logo */}
        <header className="px-6 lg:px-10 py-6 border-b border-charcoal/[0.06]">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/logo-carglow.png"
              alt="CarGlow"
              width={500}
              height={500}
              className="h-20 w-auto object-contain"
              priority
            />
          </Link>
        </header>

        {/* Form area */}
        <main className="flex-1 flex items-center justify-center px-6 lg:px-10 py-8">
          <div className="w-full max-w-md">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="px-6 lg:px-10 py-6 border-t border-charcoal/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs text-charcoal/40">
          <div>© {new Date().getFullYear()} CarGlow</div>
          <div className="flex items-center gap-4">
            <Link href="/legal/terms"   className="hover:text-charcoal/70">CGU</Link>
            <Link href="/legal/privacy" className="hover:text-charcoal/70">Confidentialité</Link>
            <Link href="/contact" className="hover:text-charcoal/70">Support</Link>
          </div>
        </footer>
      </div>

      {/* ── Visual column ───────────────────────────────────────────── */}
      <aside className="hidden lg:block lg:w-[44%] xl:w-[48%] relative overflow-hidden">
        {/* Scrolling background — real CarGlow renders */}
        <AuthVisualCarousel />
        {/* Dark overlay for text readability over the photo */}
        <div className="absolute inset-0 bg-gradient-to-br from-charcoal/80 via-charcoal/60 to-charcoal/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-transparent to-transparent" />

        {/* Accent glow orbs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-accent-500/20 blur-[90px]" />
        <div className="absolute bottom-1/3 -left-16 w-64 h-64 rounded-full bg-accent-600/15 blur-[80px]" />

        {/* Content */}
        <div className="relative h-full flex flex-col justify-between p-10 xl:p-14">
          <div className="max-w-md">
            <div className="eyebrow-light mb-3">
              Photos de véhicules par IA
            </div>
            <h2 className="font-display font-bold tracking-tight text-3xl xl:text-4xl leading-[1.1] text-offwhite">
              Des photos de showroom{' '}
              <span className="text-gradient-dark">en 60 secondes.</span>
            </h2>
            <p className="text-offwhite/60 mt-3 text-[15px] leading-relaxed">
              Photographiez votre véhicule au smartphone. Notre IA le transforme en rendu photoréaliste
              prêt à publier — aucune compétence technique requise.
            </p>
          </div>

          {/* Testimonial card — only once a real review has been approved */}
          {authTestimonial && (
          <div className="glass rounded-2xl border border-offwhite/[0.12] p-5 max-w-md">
            <Quote className="w-5 h-5 text-accent-400 mb-3" strokeWidth={1.5} />
            <p className="text-[15px] text-offwhite/85 leading-relaxed">
              {authTestimonial.quote}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <TestimonialAvatar name={authTestimonial.name} className="w-9 h-9 shrink-0 ring-1 ring-white/15" />
              <div>
                <div className="text-sm font-medium text-offwhite">{authTestimonial.name}</div>
                {(authTestimonial.role || authTestimonial.location) && (
                  <div className="text-xs text-offwhite/50">{[authTestimonial.role, authTestimonial.location].filter(Boolean).join(' · ')}</div>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </aside>
    </div>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Link } from '@/i18n/routing'
import RouteLink from 'next/link'
import { useConsent } from '@/components/consent/ConsentProvider'
import { trackEvent, ANALYTICS_EVENTS } from '@/lib/analytics/client'

export function Footer() {
  const t = useTranslations('footer')
  const { openBanner } = useConsent()

  return (
    <footer className="bg-offwhite border-t border-charcoal/[0.06]">
      {/* CTA band */}
      <div className="border-b border-charcoal/[0.06]">
        <div className="page-container py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-lg font-display font-semibold text-charcoal">
              {t('ctaTitle')}
            </p>
            <p className="text-sm text-charcoal/50 mt-1">
              {t('ctaBody')}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/contact"
              className="px-5 py-2.5 rounded-xl border border-charcoal/[0.12] text-sm font-medium text-charcoal/70 hover:text-charcoal hover:bg-charcoal/[0.05] transition-all">
              {t('ctaSecondary')}
            </Link>
            <RouteLink href="/signup"
              onClick={() => trackEvent(ANALYTICS_EVENTS.CTA_CLICKED, { ctaId: 'footer', label: t('ctaButton'), location: 'footer' })}
              className="px-5 py-2.5 rounded-xl bg-accent-500 hover:bg-accent-600 text-sm font-semibold text-white shadow-accent-sm hover:shadow-accent-md transition-all">
              {t('ctaButton')} →
            </RouteLink>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="page-container py-12">
        <div className="flex flex-col md:flex-row gap-12 md:gap-8 justify-between">
          {/* Brand */}
          <div className="shrink-0">
            <Link href="/" className="inline-flex mb-4">
              <Image
                src="/logo-autostudio.png"
                alt="AutoStudio"
                width={500}
                height={500}
                className="h-20 w-auto object-contain rounded-xl"
              />
            </Link>
            <p className="text-xs text-charcoal/40 leading-relaxed max-w-[200px]">
              {t('tagline')}
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-charcoal/30 mb-4">Produit</h4>
              <ul className="flex flex-col gap-2.5">
                <li><Link href="/#comment-ca-marche" className="text-sm text-charcoal/50 hover:text-charcoal/90 transition-colors">Comment ça marche</Link></li>
                <li><Link href="/#tarifs" className="text-sm text-charcoal/50 hover:text-charcoal/90 transition-colors">Tarifs</Link></li>
                <li><Link href="/guide" className="text-sm text-charcoal/50 hover:text-charcoal/90 transition-colors">Guide utilisateur</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-charcoal/30 mb-4">Entreprise</h4>
              <ul className="flex flex-col gap-2.5">
                <li><Link href="/about" className="text-sm text-charcoal/50 hover:text-charcoal/90 transition-colors">À propos</Link></li>
                <li><Link href="/blog" className="text-sm text-charcoal/50 hover:text-charcoal/90 transition-colors">Blog</Link></li>
                <li><Link href="/contact" className="text-sm text-charcoal/50 hover:text-charcoal/90 transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-charcoal/30 mb-4">Légal</h4>
              <ul className="flex flex-col gap-2.5">
                <li><Link href="/legal/terms" className="text-sm text-charcoal/50 hover:text-charcoal/90 transition-colors">Conditions générales</Link></li>
                <li><Link href="/legal/privacy" className="text-sm text-charcoal/50 hover:text-charcoal/90 transition-colors">Confidentialité</Link></li>
                <li><Link href="/legal/cookies" className="text-sm text-charcoal/50 hover:text-charcoal/90 transition-colors">Cookies</Link></li>
                <li><Link href="/legal/mentions" className="text-sm text-charcoal/50 hover:text-charcoal/90 transition-colors">Mentions légales</Link></li>
                <li>
                  <button onClick={openBanner} className="text-sm text-charcoal/50 hover:text-charcoal/90 transition-colors text-left">
                    Gérer les cookies
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-charcoal/[0.06]">
        <div className="page-container pt-5 pb-24 lg:pb-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-charcoal/30">
            © {new Date().getFullYear()} AutoStudio. {t('copyright')}
          </p>
          <p className="text-xs text-charcoal/20">
            🇫🇷 {t('builtInEurope')}
          </p>
        </div>
      </div>
    </footer>
  )
}

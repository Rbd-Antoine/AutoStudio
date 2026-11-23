import RouteLink from 'next/link'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { TrackedLink } from '../_components/TrackedLink'

// The dark top bar of the pages that continue the studio home page (the guides): the same band
// as the home page's header, with plain links instead of the scroll chapters. The guides are
// written in French only, so the labels are too.
const LINKS = [
  { href: '/#studio', label: 'Le studio' },
  { href: '/#fonds', label: 'Les fonds' },
  { href: '/features', label: 'Fonctionnalités' },
  { href: '/#tarifs', label: 'Tarifs' },
  { href: '/guides', label: 'Guides' },
] as const

export function StudioBar({ active }: { active?: '/guides' | '/features' }) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-[#2A2D3199] bg-[#0C0D0F]">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-16">
        <Link href="/" aria-label="AutoStudio, accueil" className="font-[family-name:var(--font-studio-display)] text-2xl font-extrabold uppercase tracking-[0.02em] text-[#ECE8E1]">
          AutoStudio
        </Link>
        <nav aria-label="Site" className="hidden items-center gap-6 md:flex">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} aria-current={active === l.href ? 'page' : undefined}
              className={cn('text-sm transition-colors hover:text-[#ECE8E1]', active === l.href ? 'text-[#ECE8E1]' : 'text-[#B5B0A7]')}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-4">
          <RouteLink href="/signin" className="hidden px-2 py-2 text-sm text-[#CFCAC1] transition-colors hover:text-[#ECE8E1] sm:block">Connexion</RouteLink>
          <TrackedLink href="/signup" ctaId="guides_header" label="Essayer gratuitement" location="guides_header"
            className="rounded-sm bg-[#F2A93B] px-4 py-2.5 text-sm font-semibold text-[#0C0D0F] transition-transform hover:-translate-y-0.5">
            Essayer gratuitement
          </TrackedLink>
        </div>
      </div>
    </header>
  )
}

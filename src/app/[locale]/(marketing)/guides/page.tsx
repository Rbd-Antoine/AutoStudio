import type { Metadata } from 'next'
import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { getPublishedGuides, GUIDE_CATEGORIES, SITE_URL } from '@/lib/guides'
import { display, sans } from '../_studio/fonts'
import { StudioBar } from '../_studio/StudioBar'

// The guides' index: published guides by category, in the home page's dark studio look.
// Rebuilt every hour so a guide whose date comes appears without a deploy.
export const revalidate = 3600

const TITLE = 'Guides photo pour vendeurs de voitures'
const DESCRIPTION = "Photographier, préparer et présenter un véhicule d'occasion : des guides pratiques pour concessions et vendeurs, de la prise de vue à l'annonce."

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | AutoStudio` },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/guides` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/guides`, type: 'website' },
}

const DISPLAY = 'font-[family-name:var(--font-studio-display)] uppercase'

export default function GuidesIndexPage() {
  const guides = getPublishedGuides()
  const byCategory = GUIDE_CATEGORIES.map(c => ({ category: c, guides: guides.filter(g => g.frontmatter.categorie === c) })).filter(s => s.guides.length > 0)
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: TITLE,
    itemListElement: guides.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/guides/${g.frontmatter.slug}`, name: g.frontmatter.title })),
  }

  return (
    <div className={cn(display.variable, sans.variable, 'min-h-screen bg-[#0C0D0F] font-[family-name:var(--font-studio-sans)] text-[#ECE8E1] antialiased')}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <StudioBar active="/guides" />
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-32 sm:px-8 lg:px-12">
        <nav aria-label="Fil d'Ariane" className="text-xs text-[#9A968E]">
          <Link href="/" className="hover:text-[#ECE8E1]">Accueil</Link>
          <span className="mx-2">/</span>
          <span className="text-[#CFCAC1]">Guides</span>
        </nav>
        <p className="mt-8 text-xs font-medium uppercase tracking-[0.22em] text-[#F2A93B]">Guides</p>
        <h1 className={cn(DISPLAY, 'mt-3 max-w-3xl font-extrabold leading-[0.9]')} style={{ fontSize: 'clamp(2.75rem, 6vw, 5.25rem)' }}>{TITLE}</h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#BDB8AF] sm:text-lg">{DESCRIPTION}</p>

        {byCategory.map(section => (
          <section key={section.category} className="mt-16" aria-labelledby={`cat-${section.category}`}>
            <h2 id={`cat-${section.category}`} className={cn(DISPLAY, 'border-b border-[#2A2D31] pb-3 text-2xl font-bold')}>{section.category}</h2>
            <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {section.guides.map(g => (
                <li key={g.frontmatter.slug}>
                  <Link href={`/guides/${g.frontmatter.slug}`} className="group block">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-[#1A1C1F]">
                      <Image src={g.frontmatter.image} alt={g.frontmatter.image_alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold leading-snug text-[#ECE8E1] transition-colors group-hover:text-[#F2A93B]">{g.frontmatter.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#9A968E]">{g.frontmatter.description}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#9A968E]">{g.frontmatter.temps_lecture} min de lecture</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="mt-24 border-t border-[#2A2D31] pt-12">
          <p className={cn(DISPLAY, 'text-3xl font-extrabold leading-tight sm:text-5xl')}>Votre voiture ne change pas. Son décor, si.</p>
          <p className="mt-4 max-w-xl text-[#BDB8AF]">Importez une photo prise au téléphone et recevez un rendu de studio en quelques secondes. Premier rendu offert, sans carte bancaire.</p>
          <Link href="/signup" className="mt-7 inline-block rounded-sm bg-[#F2A93B] px-7 py-3.5 font-semibold text-[#0C0D0F] transition-transform hover:-translate-y-0.5">Essayer gratuitement</Link>
        </div>
      </div>
    </div>
  )
}

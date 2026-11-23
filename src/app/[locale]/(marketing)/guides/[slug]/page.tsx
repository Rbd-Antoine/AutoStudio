import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { getPublishedGuide, getPublishedGuides, relatedGuides, unpublishLinks, SITE_URL } from '@/lib/guides'
import { GuideBody } from '../../_studio/GuideBody'
import { display, sans } from '../../_studio/fonts'
import { StudioBar } from '../../_studio/StudioBar'

// One guide, in the dark studio look of the home page. Guides not published yet are not served
// (404); the page is regenerated every hour, so a guide goes live on its date without a deploy.
export const revalidate = 3600
export const dynamicParams = true

export function generateStaticParams() {
  return getPublishedGuides().map(g => ({ slug: g.frontmatter.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const guide = getPublishedGuide(slug)
  if (!guide) return {}
  const { meta_title, description, image, image_alt, date } = guide.frontmatter
  const url = `${SITE_URL}/guides/${slug}`
  return {
    title: { absolute: meta_title },
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', title: meta_title, description, url, publishedTime: date, images: [{ url: image, alt: image_alt }] },
    twitter: { card: 'summary_large_image', title: meta_title, description, images: [image] },
  }
}

const DISPLAY = 'font-[family-name:var(--font-studio-display)] uppercase'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = getPublishedGuide(slug)
  if (!guide) notFound()
  const { title, description, categorie, date, temps_lecture, auteur, image, image_alt, image_legende } = guide.frontmatter
  const url = `${SITE_URL}/guides/${slug}`
  // Links to guides scheduled later read as plain text until their date.
  const segments = guide.segments.map(s => ('html' in s ? { ...s, html: unpublishLinks(s.html) } : s))
  const related = relatedGuides(guide)

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: date,
    dateModified: date,
    author: { '@type': 'Person', name: auteur },
    publisher: { '@type': 'Organization', name: 'AutoStudio', url: SITE_URL },
    image: `${SITE_URL}${image}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_URL}/guides` },
      { '@type': 'ListItem', position: 3, name: title, item: url },
    ],
  }
  const faqLd = guide.faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guide.faqItems.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answerText } })),
  } : null

  return (
    <div className={cn(display.variable, sans.variable, 'studio-article min-h-screen bg-[#0C0D0F] font-[family-name:var(--font-studio-sans)] text-[#ECE8E1] antialiased')}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}
      <StudioBar active="/guides" />

      <article className="mx-auto max-w-3xl px-4 pb-20 pt-32 sm:px-8">
        <nav aria-label="Fil d'Ariane" className="text-xs text-[#9A968E]">
          <Link href="/" className="hover:text-[#ECE8E1]">Accueil</Link>
          <span className="mx-2">/</span>
          <Link href="/guides" className="hover:text-[#ECE8E1]">Guides</Link>
          <span className="mx-2">/</span>
          <span className="text-[#CFCAC1]">{categorie}</span>
        </nav>
        <p className="mt-8 text-xs font-medium uppercase tracking-[0.22em] text-[#F2A93B]">{categorie}</p>
        <h1 className={cn(DISPLAY, 'mt-3 font-extrabold leading-[0.92]')} style={{ fontSize: 'clamp(2.4rem, 5.5vw, 4.25rem)' }}>{title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-[#BDB8AF]">{description}</p>
        <p className="mt-6 border-y border-[#2A2D31] py-4 text-sm text-[#9A968E]">
          {auteur} · {formatDate(date)} · {temps_lecture} min de lecture
        </p>

        <figure className="mt-10">
          <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-[#1A1C1F]">
            <Image src={image} alt={image_alt} fill priority sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
          </div>
          <figcaption className="mt-3 text-xs leading-relaxed text-[#9A968E]">{image_legende}</figcaption>
        </figure>

        <div className="mt-10">
          <GuideBody segments={segments} />
        </div>
      </article>

      {related.length > 0 && (
        <aside className="mx-auto max-w-6xl border-t border-[#2A2D31] px-4 py-16 sm:px-8 lg:px-12" aria-labelledby="guides-lies">
          <h2 id="guides-lies" className={cn(DISPLAY, 'text-2xl font-bold')}>À lire aussi</h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-3">
            {related.map(g => (
              <li key={g.frontmatter.slug}>
                <Link href={`/guides/${g.frontmatter.slug}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-[#1A1C1F]">
                    <Image src={g.frontmatter.image} alt={g.frontmatter.image_alt} fill sizes="(min-width: 640px) 33vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  </div>
                  <p className="mt-3 font-semibold leading-snug transition-colors group-hover:text-[#F2A93B]">{g.frontmatter.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  )
}

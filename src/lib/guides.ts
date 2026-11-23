import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { parseArticleBody, getAllArticlesUnfiltered, type BlogSegment } from './blog'
import type { FaqItem } from './markdown'

export { SITE_URL } from './site-config'

// The SEO guides for car dealers (/guides, content/guides/*.md), on the model of Florelis's:
// each guide answers one query dealers actually type (found in Google's French autocomplete,
// `keyword`, never shown) and goes live on its `date`. A guide whose date has not come yet is
// neither listed, nor in the sitemap, nor served, so a batch written at once is published two or
// three a week.
//
// Everything is checked when the files are read, so a broken guide fails the build: frontmatter,
// no H1 in the body (the page renders `title`), internal links to guides and blog articles, the
// illustration file, and no em dash (the house style uses commas, colons and parentheses).

const DIR = path.join(process.cwd(), 'content/guides')

export interface GuideFrontmatter {
  title: string
  meta_title: string
  slug: string
  description: string
  keyword: string
  keywords_secondaires: string[]
  categorie: GuideCategory
  date: string
  temps_lecture: number
  auteur: string
  image: string
  image_alt: string
  /** What the illustration is, said under it: a real AutoStudio render, or the photo before. */
  image_legende: string
}

export interface GuideArticle {
  frontmatter: GuideFrontmatter
  segments: BlogSegment[]
  faqItems: FaqItem[]
}

/** The categories, in the order the index lists them. */
export const GUIDE_CATEGORIES = ['Photo et préparation', 'Studio et décors', 'Outils et IA', 'Annonces et diffusion'] as const
export type GuideCategory = (typeof GUIDE_CATEGORIES)[number]

function fail(file: string, why: string): never {
  throw new Error(`[guides] ${file}: ${why}`)
}

function validate(data: Record<string, unknown>, file: string): GuideFrontmatter {
  for (const k of ['title', 'meta_title', 'slug', 'description', 'keyword', 'categorie', 'auteur', 'image', 'image_alt', 'image_legende'] as const) {
    if (typeof data[k] !== 'string' || !(data[k] as string).trim()) fail(file, `champ "${k}" manquant`)
  }
  const date = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(file, `date invalide "${date}"`)
  if (!Array.isArray(data.keywords_secondaires)) fail(file, 'keywords_secondaires doit être une liste')
  if (typeof data.temps_lecture !== 'number') fail(file, 'temps_lecture doit être un nombre de minutes')
  if (`${data.slug}.md` !== file) fail(file, `le fichier doit s'appeler ${data.slug}.md`)
  if ((data.meta_title as string).length > 70) fail(file, `meta_title de ${(data.meta_title as string).length} caractères (70 maximum)`)
  if ((data.description as string).length > 165) fail(file, `description de ${(data.description as string).length} caractères (165 maximum)`)
  if (!GUIDE_CATEGORIES.includes(data.categorie as GuideCategory)) fail(file, `catégorie inconnue "${data.categorie}"`)
  if (!fs.existsSync(path.join(process.cwd(), 'public', data.image as string))) fail(file, `image introuvable : public${data.image}`)
  return { ...data, date } as unknown as GuideFrontmatter
}

/** Today in France, as YYYY-MM-DD: a guide dated today is live from midnight, Paris time. */
function todayInFrance(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

let cache: GuideArticle[] | null = null

/** Every guide, published or scheduled, newest first. Throws on any invalid file. */
export function getAllGuidesUnfiltered(): GuideArticle[] {
  if (cache) return cache
  if (!fs.existsSync(DIR)) return (cache = [])
  const parsed = fs.readdirSync(DIR).filter(f => f.endsWith('.md')).map(file => {
    const { data, content } = matter(fs.readFileSync(path.join(DIR, file), 'utf-8'))
    if (content.includes('—')) fail(file, 'tiret cadratin (—) interdit : virgule, deux-points ou parenthèses')
    return { file, frontmatter: validate(data, file), content }
  })
  const guideSlugs = new Set(parsed.map(p => p.frontmatter.slug))
  const blogSlugs = new Set(getAllArticlesUnfiltered().map(a => a.frontmatter.slug))
  const guides = parsed.map(({ file, frontmatter, content }) => {
    const { segments, faqItems } = parseArticleBody(content, file, { '/guides/': guideSlugs, '/blog/': blogSlugs })
    return { frontmatter, segments, faqItems }
  })
  guides.sort((a, b) => (a.frontmatter.date < b.frontmatter.date ? 1 : a.frontmatter.date > b.frontmatter.date ? -1 : a.frontmatter.title.localeCompare(b.frontmatter.title)))
  return (cache = guides)
}

/** The guides live today. */
export function getPublishedGuides(): GuideArticle[] {
  const today = todayInFrance()
  return getAllGuidesUnfiltered().filter(g => g.frontmatter.date <= today)
}

export function getPublishedGuide(slug: string): GuideArticle | null {
  return getPublishedGuides().find(g => g.frontmatter.slug === slug) ?? null
}

/** Up to `n` other published guides, the same category first. */
export function relatedGuides(guide: GuideArticle, n = 3): GuideArticle[] {
  const others = getPublishedGuides().filter(g => g.frontmatter.slug !== guide.frontmatter.slug)
  const same = others.filter(g => g.frontmatter.categorie === guide.frontmatter.categorie)
  return [...same, ...others.filter(g => g.frontmatter.categorie !== guide.frontmatter.categorie)].slice(0, n)
}

/** Links to guides not published yet are shown as plain text until their date. */
export function unpublishLinks(html: string): string {
  const live = new Set(getPublishedGuides().map(g => g.frontmatter.slug))
  return html.replace(/<a href="\/guides\/([^"#?]+)"[^>]*>(.*?)<\/a>/g, (whole, slug: string, text: string) => (live.has(slug) ? whole : text))
}

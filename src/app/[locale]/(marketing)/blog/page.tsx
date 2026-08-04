import type { Metadata } from 'next'
import { Link } from '@/i18n/routing'
import { Clock } from 'lucide-react'
import { getAllArticles, SITE_URL } from '@/lib/blog'
import { BlogImage } from '@/components/blog/BlogImage'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Conseils terrain pour concessions : vendre plus vite, se conformer à l\'AI Act sur les mentions IA, et publier de meilleures annonces.',
  alternates: { canonical: `${SITE_URL}/blog` },
}

export default function BlogIndexPage() {
  const articles = getAllArticles()
  const featured = articles.filter((a) => a.frontmatter.featured)
  const rest = articles.filter((a) => !a.frontmatter.featured)

  return (
    <div className="pt-32 pb-20 bg-offwhite">
      <div className="page-container max-w-5xl">
        <p className="eyebrow mb-4">Blog</p>
        <h1 className="font-display font-bold text-charcoal mb-4" style={{ fontSize: 'clamp(2rem,4vw,3rem)' }}>
          Le métier de concession,<br /><span className="text-gradient">pas le gadget IA.</span>
        </h1>
        <p className="text-charcoal/50 text-lg max-w-2xl mb-14">
          Vendre plus vite, rester conforme sur les mentions IA obligatoires, publier de meilleures
          annonces — écrit pour des professionnels de l&apos;automobile, pas par un éditeur SaaS.
        </p>

        {featured.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {featured.map((article) => (
              <ArticleCard key={article.frontmatter.slug} article={article} large />
            ))}
          </div>
        )}

        {rest.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((article) => (
              <ArticleCard key={article.frontmatter.slug} article={article} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ArticleCard({ article, large }: { article: ReturnType<typeof getAllArticles>[number]; large?: boolean }) {
  const { title, description, slug, category, readingTime, image, imageAlt } = article.frontmatter
  return (
    <Link
      href={`/blog/${slug}`}
      className="group flex flex-col rounded-2xl border border-charcoal/[0.08] bg-white overflow-hidden hover:border-accent-300 hover:shadow-card transition-all"
    >
      <div className={large ? 'relative aspect-[16/9]' : 'relative aspect-[4/3]'}>
        <BlogImage src={image} alt={imageAlt} title={title} />
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="px-2 py-0.5 rounded-md bg-accent-50 border border-accent-200/60 text-accent-700 text-[11px] font-semibold">
            {category}
          </span>
          <span className="text-[11px] text-charcoal/35 flex items-center gap-1">
            <Clock className="w-3 h-3" strokeWidth={1.75} />
            {readingTime} min
          </span>
        </div>
        <h2 className={large ? 'font-display font-semibold text-charcoal text-xl leading-snug mb-2 group-hover:text-accent-700 transition-colors' : 'font-display font-semibold text-charcoal text-base leading-snug mb-2 group-hover:text-accent-700 transition-colors'}>
          {title}
        </h2>
        <p className="text-sm text-charcoal/50 leading-relaxed line-clamp-3">{description}</p>
      </div>
    </Link>
  )
}

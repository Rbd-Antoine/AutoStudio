import { Link } from '@/i18n/routing'
import { ArrowRight, Leaf } from 'lucide-react'

export function BlogCTA({ html }: { html: string }) {
  return (
    <div className="not-prose rounded-2xl border border-accent-200 bg-accent-50/70 px-6 py-6 my-10">
      <div className="flex items-start gap-3">
        <Leaf className="w-4 h-4 text-accent-500 shrink-0 mt-1" fill="currentColor" />
        <div
          className="text-[15px] text-charcoal/70 leading-relaxed [&_strong]:font-semibold [&_strong]:text-charcoal"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
      <Link
        href="/signup"
        className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-accent-700 hover:text-accent-800 transition-colors"
      >
        Essayer CarGlow gratuitement <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

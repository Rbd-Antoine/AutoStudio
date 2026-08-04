import { Link } from '@/i18n/routing'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function GuideSignupButton({ className, full }: { className?: string; full?: boolean }) {
  return (
    <Link
      href="/signup"
      className={cn(
        'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-semibold text-sm shadow-accent-sm hover:shadow-accent-md transition-all',
        full && 'w-full',
        className,
      )}
    >
      Essayer gratuitement <ArrowRight className="w-4 h-4" />
    </Link>
  )
}

import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import type { ContentSegment } from '@/lib/markdown'

// A guide's body in the studio's dark look. The blog's ArticleBody is drawn for the light pages
// (dark text, pale boxes), so the guides render the same parsed segments with their own styles,
// scoped to this wrapper: no global stylesheet change.
const PROSE = cn(
  'text-[17px] leading-[1.75] text-[#CFCAC1]',
  '[&_p]:my-5',
  '[&_h2]:mt-14 [&_h2]:mb-4 [&_h2]:font-[family-name:var(--font-studio-display)] [&_h2]:text-[1.9rem] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:leading-[1.05] [&_h2]:text-[#ECE8E1]',
  '[&_h3]:mt-9 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[#ECE8E1]',
  '[&_strong]:font-semibold [&_strong]:text-[#ECE8E1] [&_em]:italic',
  '[&_a]:text-[#F2A93B] [&_a]:underline [&_a]:decoration-[#F2A93B66] [&_a]:underline-offset-[3px] hover:[&_a]:decoration-[#F2A93B]',
  '[&_ul]:my-5 [&_ul]:space-y-2 [&_ul]:pl-0 [&_ul>li]:relative [&_ul>li]:pl-6',
  '[&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-[0.8em] [&_ul>li]:before:h-px [&_ul>li]:before:w-3 [&_ul>li]:before:bg-[#F2A93B] [&_ul>li]:before:content-[""]',
  '[&_ol]:my-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ol>li]:pl-1 [&_ol>li]:marker:text-[#9A968E]',
  '[&_hr]:my-12 [&_hr]:border-[#2A2D31]',
  '[&_blockquote]:my-7 [&_blockquote]:border-l-2 [&_blockquote]:border-[#F2A93B] [&_blockquote]:pl-5 [&_blockquote]:text-[#BDB8AF]',
  '[&_table]:my-7 [&_table]:w-full [&_table]:text-left [&_table]:text-[15px] [&_th]:border-b [&_th]:border-[#2A2D31] [&_th]:py-2 [&_th]:pr-4 [&_th]:font-semibold [&_th]:text-[#ECE8E1] [&_td]:border-b [&_td]:border-[#1F2124] [&_td]:py-2 [&_td]:pr-4',
)

// French typography: a non-breaking space before : ; ? ! so they never start a line. Text only:
// the parser's HTML has no such sequence inside its tags.
const nb = (html: string) => html.replace(/ ([:;?!])/g, ' $1')

export function GuideBody({ segments }: { segments: ContentSegment[] }) {
  return (
    <div className={PROSE}>
      {segments.map((segment, i) => {
        switch (segment.type) {
          case 'html':
            return <div key={i} dangerouslySetInnerHTML={{ __html: nb(segment.html) }} />
          case 'callout':
            return (
              <aside key={i} className="my-8 border-l-2 border-[#F2A93B] bg-[#15171A] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F2A93B]">{segment.label}</p>
                <div className="mt-1.5 text-[15.5px] [&_p]:my-0" dangerouslySetInnerHTML={{ __html: nb(segment.html) }} />
              </aside>
            )
          case 'faq':
            return (
              <section key={i} className="mt-16" aria-labelledby="questions-frequentes">
                <h2 id="questions-frequentes">Questions fréquentes</h2>
                <dl className="mt-6 border-t border-[#2A2D31]">
                  {segment.items.map(item => (
                    <div key={item.question} className="border-b border-[#2A2D31] py-5">
                      <dt className="font-semibold text-[#ECE8E1]">{nb(item.question)}</dt>
                      <dd className="mt-2 text-[15.5px] text-[#BDB8AF] [&_p]:my-0" dangerouslySetInnerHTML={{ __html: nb(item.answerHtml) }} />
                    </div>
                  ))}
                </dl>
              </section>
            )
          case 'cta':
            return (
              <div key={i} className="mt-14 border border-[#2A2D31] bg-[#15171A] px-6 py-7 sm:px-8">
                <div className="text-[16px] text-[#CFCAC1] [&_em]:not-italic [&_p]:my-0" dangerouslySetInnerHTML={{ __html: nb(segment.html) }} />
                <Link href="/signup" className="mt-5 inline-block rounded-sm bg-[#F2A93B] px-6 py-3 text-sm font-semibold !text-[#0C0D0F] !no-underline transition-transform hover:-translate-y-0.5">
                  Essayer gratuitement
                </Link>
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}

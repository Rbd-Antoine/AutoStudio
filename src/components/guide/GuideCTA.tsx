import { GuideSignupButton } from './GuideSignupButton'

export function GuideCTA({ html }: { html: string }) {
  return (
    <div className="not-prose rounded-3xl border border-accent-200 bg-accent-50 px-8 py-10 my-10 text-center">
      <div
        className="[&_h3]:font-display [&_h3]:font-bold [&_h3]:text-2xl [&_h3]:text-charcoal [&_h3]:mb-2 [&_p]:text-charcoal/60 [&_p]:text-[15px] [&_p]:max-w-md [&_p]:mx-auto [&_p]:mb-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <GuideSignupButton className="mx-auto" />
    </div>
  )
}

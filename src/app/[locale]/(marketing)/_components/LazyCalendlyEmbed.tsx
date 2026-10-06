'use client'

import { useEffect, useRef, useState } from 'react'

// `url` is the booking page from NEXT_PUBLIC_CALENDLY_URL (e.g. https://calendly.com/<compte>/demo);
// the inline-embed parameters and brand colours are added here.
export function LazyCalendlyEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    if (shouldLoad || !containerRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setShouldLoad(true) },
      { rootMargin: '200px' },
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [shouldLoad])

  return (
    <div ref={containerRef} className="h-[560px] sm:h-[640px] lg:h-[700px]">
      {shouldLoad ? (
        <iframe
          src={`${url}${url.includes('?') ? '&' : '?'}embed_type=Inline&hide_gdpr_banner=1&background_color=fafaf7&text_color=14161a&primary_color=2d7ff9`}
          width="100%"
          height="100%"
          style={{ border: 'none' }}
          title="Réserver une démo CarGlow"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-offwhite">
          <div className="w-6 h-6 border-2 border-accent-300 border-t-accent-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

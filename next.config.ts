import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  images: {
    // Static /public photos essentially never change — cache the optimized variants for a
    // year instead of Next's 60s default, so repeat visits (and CDN edges) don't re-optimize.
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' }, // Vercel Blob (generated renders)
      { protocol: 'https', hostname: '**.fal.media' }, // legacy renders from the pre-Blob fal.ai storage era
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google account profile photos
    ],
  },
  experimental: {
    reactCompiler: false,
  },
  serverExternalPackages: ['sharp'],
  // Baseline hardening on every response. No Content-Security-Policy yet: PostHog, the Meta
  // Pixel and the Calendly embed would each need allow-listing, and a wrong policy silently
  // breaks them.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)

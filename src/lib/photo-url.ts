// `originalUrl` is written as one of these internal sentinels while a Photo row is being
// processed (see /api/retouch, /api/background-swap) and
// only replaced with a real hosted URL once the upload finishes. A row that fails or gets stuck
// mid-flight can keep the sentinel indefinitely — anything falling back to `originalUrl` for
// display must filter these out first, or a single stuck photo crashes the whole page (next/image
// throws synchronously on a src that isn't a URL/path).
const LEGACY_PLACEHOLDERS = ['jardin-direct-upload', 'jardin-retouche', 'car-direct-upload', 'car-retouche']

export function isRealHostedUrl(url: string | null | undefined): url is string {
  return !!url && !url.startsWith('data:') && !LEGACY_PLACEHOLDERS.includes(url)
}

// Images the server fetches on a user's behalf (retouch source, marketing-kit logo) must come
// from Vercel Blob, where every render, original and logo is stored. Fetching an arbitrary URL
// from the request body would let anyone make the server call internal or third-party hosts.
const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com'

export function isOwnBlobUrl(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith(BLOB_HOST_SUFFIX)
  } catch {
    return false
  }
}

// `originalUrl` is written as one of these internal sentinels while a Photo row is being
// processed (see /api/generate, /api/retouch, /api/background-swap, /api/generate-video) and
// only replaced with a real hosted URL once the upload finishes. A row that fails or gets stuck
// mid-flight can keep the sentinel indefinitely — anything falling back to `originalUrl` for
// display must filter these out first, or a single stuck photo crashes the whole page (next/image
// throws synchronously on a src that isn't a URL/path).
const LEGACY_PLACEHOLDERS = ['jardin-direct-upload', 'jardin-retouche', 'car-direct-upload', 'car-retouche']

export function isRealHostedUrl(url: string | null | undefined): url is string {
  return !!url && !url.startsWith('data:') && !LEGACY_PLACEHOLDERS.includes(url)
}

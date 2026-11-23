// Pages drawn in the home page's dark studio look: they bring their own top bar (the global light
// Nav steps aside) and get the dark footer. Paths are next-intl's, without the locale prefix.
const STUDIO_SECTIONS = ['/guides', '/features']

export function isStudioPath(pathname: string): boolean {
  return pathname === '/' || STUDIO_SECTIONS.some(s => pathname === s || pathname.startsWith(`${s}/`))
}

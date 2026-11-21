import { Big_Shoulders, IBM_Plex_Sans } from 'next/font/google'

// The home page's two typefaces (DESIGN.md): a condensed industrial display born from Chicago's
// signage, for the chapter titles, and a technical, readable sans for everything else. Scoped
// to the home page through CSS variables, so the rest of the site keeps its own type.
// Big Shoulders is a variable font whose optical-size axis turns into the Display cut at large
// sizes (font-optical-sizing: auto), which is how the chapter titles are set.
export const display = Big_Shoulders({
  subsets: ['latin'],
  weight: 'variable',
  axes: ['opsz'],
  variable: '--font-studio-display',
  display: 'swap',
})

export const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-studio-sans',
  display: 'swap',
})

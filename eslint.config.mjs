import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  // Generated files, as in Next.js's own template: the build output (linted after `next build`,
  // it reported thousands of issues in compiled chunks) and next-env.d.ts.
  { ignores: ['.next/**', 'node_modules/**', 'src/generated/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Allow <img> for demo/placeholder images (replace with next/image in prod)
      '@next/next/no-img-element': 'warn',
      // Allow explicit any in a few places during rapid development
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]

export default eslintConfig

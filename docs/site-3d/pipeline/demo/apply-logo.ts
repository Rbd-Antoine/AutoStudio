// Places the demo logo on a render with the product's own code (src/lib/logo-overlay.server.ts),
// exactly as the editor's "Votre logo" does: npx tsx docs/site-3d/pipeline/demo/apply-logo.ts <render> <logo> <out> [corner]
import fs from 'node:fs'
import { applyLogo, isLogoCorner } from '../../../../src/lib/logo-overlay.server'

const [render, logo, out, corner = 'bottom-right'] = process.argv.slice(2)
if (!isLogoCorner(corner)) throw new Error('coin invalide')
const logoUrl = `data:image/png;base64,${fs.readFileSync(logo).toString('base64')}`
applyLogo(fs.readFileSync(render).toString('base64'), logoUrl, corner).then(result => {
  fs.writeFileSync(out, Buffer.from(result.base64, 'base64'))
  console.log('ok', out)
})

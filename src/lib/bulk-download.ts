import { downloadZip } from 'client-zip'

// Browser-only. Downloads several renders as one zip, built in the browser while the files
// arrive (4 at a time), so nothing waits on a serverless function and no size limit applies
// (ported from Florelis's "Mes projets"). A dealer publishes 10 to 20 photos per vehicle: one
// click instead of twenty. Renders are public Vercel Blob files (CORS open) or, for a few
// older ones and in local development, data: URIs — fetch() reads both.

export interface BulkFile {
  id: string
  url: string
  /** Name inside the zip, extension included. Made unique here when two collide. */
  filename: string
}

export interface BulkDownloadResult {
  /** Files saved. */
  ok: number
  /** Ids of the files that could not be fetched: skipped, never stopping the zip. */
  failed: string[]
}

const PARALLEL = 4

function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

/** "audi-a3.png" twice in one zip becomes "audi-a3.png" and "audi-a3-2.png". */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map(name => {
    const count = (seen.get(name) ?? 0) + 1
    seen.set(name, count)
    if (count === 1) return name
    const dot = name.lastIndexOf('.')
    return dot > 0 ? `${name.slice(0, dot)}-${count}${name.slice(dot)}` : `${name}-${count}`
  })
}

/** A file name from free text (a vehicle's name): ASCII, lowercase, dashes. */
export function slugForFile(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'rendu'
}

export async function bulkDownload(files: BulkFile[], onProgress?: (done: number, total: number) => void): Promise<BulkDownloadResult> {
  const names = uniqueNames(files.map(f => f.filename))
  const entries = files.map((f, i) => ({ ...f, filename: names[i] }))
  const failed: string[] = []
  let done = 0

  async function* zipEntries() {
    const queue = [...entries]
    const inflight: Promise<{ e: BulkFile; blob: Blob | null }>[] = []
    const start = () => {
      const e = queue.shift()
      if (!e) return
      inflight.push(
        fetch(e.url)
          .then(r => (r.ok ? r.blob() : null))
          .catch(() => null)
          .then(blob => ({ e, blob })),
      )
    }
    for (let i = 0; i < PARALLEL; i++) start()
    while (inflight.length) {
      const { e, blob } = await inflight.shift()!
      start()
      onProgress?.(++done, entries.length)
      if (!blob) {
        failed.push(e.id)
        continue
      }
      yield { name: e.filename, input: blob }
    }
  }

  const zip = await downloadZip(zipEntries()).blob()
  if (failed.length < entries.length) saveBlob(zip, `autostudio-rendus-${new Date().toISOString().slice(0, 10)}.zip`)
  return { ok: entries.length - failed.length, failed }
}

// A request that always ends (ported from Florelis, where on 2026-11-15 a render that ran past the platform's
// limit was cut with its credit taken and its record left « processing »: nothing in the route's own
// catch ever ran. The route now races its work against a limit of its own, set before the
// platform's, and gives the render up itself — refund, failed record, an answer in words.
//
// Pure: shared by the routes and the offline check (scripts/check-watchdog.ts).

export interface WatchedRun {
  /** The render is drawn and judged, only being stored: it is left to end on its own. */
  finishing: boolean
  /** Set when the limit was reached: the work must deliver nothing any more. */
  abandoned: boolean
}

export type Watched<T> = { ended: true; value: T } | { ended: false }

/**
 * The work's own end when it comes within `ms` — or after it, when it was already storing its
 * result. Otherwise the run is marked abandoned and the caller ends the request itself; whatever
 * the work does later answers nobody (its rejection is swallowed).
 */
export async function endWithin<T>(work: Promise<T>, ms: number, run: WatchedRun): Promise<Watched<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const limit = new Promise<'limit'>(resolve => { timer = setTimeout(() => resolve('limit'), ms) })
  try {
    const first = await Promise.race([work.then(value => ({ value })), limit])
    if (first !== 'limit') return { ended: true, value: first.value }
    if (run.finishing) return { ended: true, value: await work }
    run.abandoned = true
    work.catch(() => {})
    return { ended: false }
  } finally {
    clearTimeout(timer)
  }
}

// The app's sidebar shows the credit balance it loaded with the page. A page that spends or
// grants credits announces the new balance, so the sidebar never shows more credits than the
// account has — on Florelis the editor's header and the sidebar disagreed after a few renders.
export const CREDITS_CHANGED_EVENT = 'autostudio:credits-changed'

export function announceCredits(total: number) {
  window.dispatchEvent(new CustomEvent<number>(CREDITS_CHANGED_EVENT, { detail: total }))
}

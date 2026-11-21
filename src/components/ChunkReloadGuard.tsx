// After a deploy, a tab still open on the previous build can request a JavaScript chunk whose
// content-hashed file no longer exists; on a slow phone (Facebook's in-app browser on iOS) a chunk
// can also simply time out. The page is then half-broken — a click does nothing — until the
// visitor thinks to reload, which most won't. This reloads once, automatically.
//
// An inline script in <head>, not a React effect: the chunk that fails can be one hydration needs
// (next-intl's message formatter, 2026-11-04), and an effect only runs after hydration — so the
// guard never armed for exactly the visitors it exists for.
//
// Guarded against loops: a chunk that is genuinely missing (a broken deploy, not skew) would
// otherwise reload forever. One attempt per minute, and none at all if storage is unavailable to
// record the attempt — a stuck page is bad, an endlessly reloading one is worse.
const SCRIPT = `(function(){
  var KEY = 'autostudio_chunk_reload_at', MIN = 60000;
  var RE = /ChunkLoadError|Loading chunk [\\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module/i;
  function recover(reason) {
    var text = reason && reason.name ? reason.name + ' ' + reason.message : String(reason || '');
    if (!RE.test(text)) return;
    try {
      var last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last < MIN) return;
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch (e) { return; }
    window.location.reload();
  }
  window.addEventListener('error', function (e) { recover(e.error || e.message); });
  window.addEventListener('unhandledrejection', function (e) { recover(e.reason); });
})();`

export function ChunkReloadGuard() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
}

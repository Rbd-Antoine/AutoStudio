// A browser's page translator (Chrome and Edge "Traduire", Safari) replaces each text node it
// translates with its own <font> elements. React still holds the original text node, now
// detached, and the next time it removes or inserts next to it — changing the car photo,
// showing a spinner beside a label — the DOM refuses: "Failed to execute 'removeChild' on 'Node':
// The node to be removed is not a child of this node". React treats that as fatal and the whole
// app falls to the global error page, on every retry, since the translator is still on (seen on
// the sister product Florelis with a real customer, 2026-11-13; reproduced with a simulated
// translator). Dealers abroad (the site serves Portugal and Spain too) translate pages.
//
// These two patches let React carry on instead: a node already moved away is removed from where
// it really is (or left alone if it is gone), and an insertion next to a node that moved lands
// next to what replaced it, or at the end. A translated label may then lag behind until the next
// render, which beats a page that cannot be used. The same workaround is the one suggested on
// facebook/react#11538, open since 2017.
//
// Inline in <head>, not a React effect: it must be in place before hydration, the first moment
// React touches the DOM.
const SCRIPT = `(function(){
  if (typeof Node !== 'function' || !Node.prototype) return;
  var remove = Node.prototype.removeChild, insert = Node.prototype.insertBefore;
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      if (child.parentNode) return remove.call(child.parentNode, child);
      return child;
    }
    return remove.apply(this, arguments);
  };
  Node.prototype.insertBefore = function (node, ref) {
    if (ref && ref.parentNode !== this) {
      var anchor = ref;
      while (anchor && anchor.parentNode !== this) anchor = anchor.parentNode;
      return insert.call(this, node, anchor || null);
    }
    return insert.apply(this, arguments);
  };
})();`

export function TranslationGuard() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
}

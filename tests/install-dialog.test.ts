import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

/**
 * Regression guard for a real bug found in the beta audit (docs/beta-audit.md, row P0-3):
 * `beforeinstallprompt` only ever fires for the page that's currently loaded (PWANova itself), never
 * for a third-party app's own origin. The third-party install dialog must never listen for it or call
 * `.prompt()` on it — doing so would silently install PWANova while labelled with the listed app's name.
 * There is no headless DOM/browser test harness in this project, so this is a source-level guard: it
 * fails loudly if the pattern is ever reintroduced. A real device/browser check still belongs in
 * docs/beta-pilot.md's manual checklist.
 */
describe("third-party install dialog never hijacks PWANova's own install prompt", () => {
  const src = readFileSync(new URL("../src/components/app/install-dialog.tsx", import.meta.url), "utf8")

  it("does not listen for the beforeinstallprompt event", () => {
    // Matches the actual dangerous pattern (wiring up a listener), not prose that merely discusses
    // why the file avoids it -- the docblock above the component names the event on purpose.
    assert.ok(!/addEventListener\(\s*["'`]beforeinstallprompt["'`]/.test(src), "install-dialog.tsx must not add a beforeinstallprompt listener")
  })
  it("does not call a deferred prompt", () => {
    assert.ok(!/\.prompt\s*\(/.test(src), "install-dialog.tsx must not call prompt() on any deferred install event")
  })
  it("always sends the visitor to the app's own domain, not PWANova", () => {
    assert.ok(/window\.open\(app\.url/.test(src), "the only install action should open the listed app's own url")
  })
})

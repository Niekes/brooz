# shadcn primitives stay as generated, and the app uses them through app-* wrappers

The shadcn components live untouched in `src/renderer/shell/ui/primitives/`,
outside the formatter, oxlint and the unused-export rule. The app never
imports them directly: every use goes through an `app-*` wrapper in
`src/renderer/shell/ui/`, which follows the house style and is where our
styling and behaviour go. Fallow enforces the wrapper rule with a
`primitives` zone only `app-*` files may import; it cannot see file contents,
so "untouched" is enforced by a checksum lockfile that `npm run lint` checks
and only `npm run ui:add` rewrites, plus a Claude Code `deny` rule on the
directory that stops an agent before the edit.

## Considered options

- Adapt the generated files to the house style: rejected - every
  `shadcn add` update would no longer diff cleanly, and our changes would
  hide inside upstream code.
- `shadcn diff` in CI: rejected - it needs the network and fails on upstream
  releases, not on our edits.

## Consequences

- The primitives cannot be patched for the CSP. Radix's ScrollArea injects
  a `<style>` tag, so the app does not use it; the Dialog's scroll lock
  does too, so `style-src` carries a per-launch nonce that the renderer
  hands to get-nonce.

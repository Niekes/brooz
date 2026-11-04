# The settings open a provider's key page

The app opens no links from the renderer: `window.open` is denied and
navigation away is prevented. The one place that sends a person out of the
app is the settings - a key has to be created at the provider. So every
provider's section shows "Get a key at <domain>" as a clickable control in
the same spot, and the click asks the main process over `brooz:key-page`.
The renderer names a provider id, never a URL; the main process looks the
domain up in the manifest (`keyUrl`, a required field of `ProviderInfo`)
and hands `https://<keyUrl>` to `shell.openExternal` - the same escape
hatch the updater already uses for the releases page.

## Considered options

- A plain anchor in the renderer: rejected - `will-navigate` rightly blocks
  it, and softening the navigation lockdown for one link inverts the
  security posture.
- A channel that takes a URL: rejected - that is an open redirect the
  moment any renderer code is confused; the id-to-manifest lookup keeps
  the reachable pages to the manifest's own domains.
- The domain as plain text, as before: rejected - retyping a domain by hand
  is friction exactly where the app is asking the person for a favor.

## Consequences

- `brooz:key-page` joins the key channels: a validated provider id in,
  nothing out, the sender check as everywhere.
- The scheme is pinned to `https://` in the main process; the manifest
  keeps storing bare domains.
- A new provider gets the control for free: `keyUrl` is already required,
  and the section renders from the manifest.

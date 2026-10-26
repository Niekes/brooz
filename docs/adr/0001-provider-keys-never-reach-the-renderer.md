# Provider keys never reach the renderer

Live tiles that need an API key never call the provider: the renderer invokes a
typed IPC channel, the main process attaches the key and performs the request,
so the CSP stays `'self'` and the renderer still fetches nothing itself. Key
management is write-only from the renderer's point of view — `key-set`,
`key-delete`, `key-status` exist, a channel that returns a key does not, so
even a fully compromised renderer has no key to read. Provider channels return
a discriminated union (`ok | missing-key | provider-error`) instead of
throwing, so the type system forces every tile to handle the missing-key
state. OAuth-style user flows (refresh tokens, redirect flows) are out of
scope by design; a provider that needs OAuth needs its own design and ADR.

## Considered options

- Renderer-side fetch with a per-provider CSP opening: rejected — it would
  turn the renderer back into a key holder, the one outcome this design exists
  to prevent.
- A read-back channel so the settings UI can "edit" a key: rejected — API keys
  are opaque strings; nobody edits them, they get re-pasted, so the UX loss is
  near zero while the attack surface would be real.

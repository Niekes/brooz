# The OpenSky key is an OAuth2 client, used by the main process alone

OpenSky dropped basic authentication: it exclusively supports the OAuth2
_client credentials_ flow, so a key is an API client's `client_id` and
`client_secret`, exchanged for a bearer token that expires after 30 minutes
(https://openskynetwork.github.io/opensky-api/rest.html). The key store holds
one string per provider (`docs/adr/0001`, `docs/adr/0002`), so the one string
is the client written as `clientId:clientSecret`. Only the main process splits
it: `src/main/opensky.ts` posts the `client_credentials` grant to the token
endpoint, caches the token until shortly before it expires, and sends
`Authorization: Bearer <token>` on the states request. A 401 from the API
means the token expired: the client refreshes the token once and retries the
request once. Both requests are made by the main process, so the renderer's
CSP stays `'self'` and neither the client id nor the secret ever reaches the
renderer.

## Considered options

- Basic auth with `username:password` as the key: rejected - OpenSky no longer
  accepts it.
- Two key fields for id and secret: rejected - the key store is one string per
  provider by design; splitting it would extend the model for no gain.
- The renderer running the token exchange itself: rejected - that would put
  the client secret in the renderer, the one outcome ADR 0001 exists to
  prevent.
- Anonymous access without a key: rejected - the anonymous rate limit is a
  hundred calls a day, too low for a live tile; and a provider channel answers
  `missing-key` without a key, which keeps every provider uniform.

## Consequences

- `brooz:flight-states` is unchanged; only the main-process client changed.
- A key without a colon is malformed: the channel answers `provider-error`
  with the expected format instead of calling the token endpoint.
- The settings' "test" key call probes the client by fetching a token and the
  feed once, so it spends one token request and one feed request.

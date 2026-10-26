# API keys are stored with safeStorage, and the app fails closed without it

Keys are encrypted with Electron's `safeStorage` (macOS Keychain, Windows DPAPI,
Linux keyring) and persisted as encrypted blobs in a file under `userData`,
decrypted on demand per provider call — no plaintext cache in memory. When
`safeStorage.isEncryptionAvailable()` returns false (typically Linux without a
running keyring service), the app refuses to store keys at all and shows why
in the settings; it never falls back to plaintext. A provider rejecting a key
(401) never deletes or flags the stored key — the user rotates it manually,
and the settings offer a per-provider "test" call to verify a key.

## Considered options

- Fail open (store as plaintext with a warning) when no OS encryption is
  available: rejected — a leaked key is more expensive than a disabled live
  tile, and "brooz stores your key unencrypted" would contradict the security
  posture the repo pins with unit tests.
- Auto-deleting an invalid key on 401: rejected — a 401 can be transient
  (shared rate limits, provider incidents), and the app destroying user data
  on its own is never the right trade.

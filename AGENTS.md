# brooz

brooz is an open-source desktop app built on Electron: an infinite dashboard
grid on a dome, in which every cell is a small app of its own - a tile. An
ask bar routes an English utterance to a tile, with keyword rules and a
local decision model (open-jev on Transformers.js) running in a Web Worker.

The repository is the scaffold plus the machinery that keeps it in shape:
zoned architecture, a template check, fallow gates, 100% coverage, and a
release flow that publishes automatically once the packaged apps pass a smoke test.

```bash
npm install
npm run dev      # the dev loop: vite dev server + electron
npm run lint     # format, oxlint, the tile template, fallow
npm test         # the unit suite
npm run build    # typecheck + renderer build + electron bundles
npm run test:e2e # against `electron .`, needs `npm run build` first
npm run package  # the installers, unsigned for now
```

<!-- fallow:setup-hooks:start -->

## Fallow checks

Use fallow for code-quality, cleanup, and setup tasks in this repository. Fallow checks the changed code before each `git commit` and `git push`. In Claude Code and Codex, a PreToolUse hook from `fallow agent install` runs this check and blocks the command when the verdict is `fail`. Other agents run the check themselves: `fallow audit --format json --quiet --explain --gate-marker agent`. If the verdict is `fail`, fix the reported findings before you try again. A JSON runtime error such as `{ "error": true, ... }` does not block.

Audit defaults to `gate=new-only`: only findings introduced by the current changeset affect the verdict. Inherited findings on touched files are reported under `attribution` and annotated with `introduced: false`, but do not block the commit. Set `[audit] gate = "all"` in `fallow.toml` to gate every finding in changed files.

For non-skill agents, treat the task map below as the local onboarding source: run the listed fallow command before destructive edits, before commits, and before pull request handoff.

## Fallow task map

| When the agent is about to...                                        | Run                                                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| delete an "unused" export or file                                    | `fallow dead-code --trace <file>:<export>`                                                                                                                    |
| prove a TypeScript symbol's exact consumers before refactoring       | `fallow dead-code --type-aware --symbol-impact <file>:<export-or-class.method>`                                                                               |
| find how one module reaches another                                  | `fallow trace --path <from> <to>` (Reports `reachable: false` instead of failing when no import path exists; type-only hops are reported, not skipped.)       |
| delete an "unused" dependency                                        | `fallow dead-code --trace-dependency <name>`                                                                                                                  |
| migrate a dependency                                                 | `fallow trace --dependency <name> --sites` (Counts each imported name, follows one hop through project wrappers, and counts each use that it cannot resolve.) |
| commit or open a PR                                                  | `fallow audit --base <ref>`                                                                                                                                   |
| read a diff before approving it                                      | `fallow review --base <ref> --brief` (orientation, never gates: deterministic and always exit 0, unlike the audit row)                                        |
| prioritize refactoring                                               | `fallow health --hotspots --targets`                                                                                                                          |
| ask who owns code                                                    | `fallow health --ownership`                                                                                                                                   |
| check untested-but-reachable code                                    | `fallow health --coverage-gaps`                                                                                                                               |
| consolidate duplication                                              | `fallow dupes --trace dup:<fingerprint>`                                                                                                                      |
| find feature flags                                                   | `fallow flags`                                                                                                                                                |
| check which architecture rules apply to a file before changing it    | `fallow guard <files>`                                                                                                                                        |
| check import cycles, boundaries and policy rules after changing code | `fallow architecture`                                                                                                                                         |
| surface security candidates                                          | `fallow security`                                                                                                                                             |
| understand a finding                                                 | `fallow explain <issue-type>`                                                                                                                                 |
| scope a monorepo                                                     | `--workspace <glob> / --changed-workspaces <ref>` (global flags, prefix any command)                                                                          |

<!-- fallow:setup-hooks:end -->

## Releasing

Releases are automatic. release-please reads the Conventional Commits on
`master` and keeps one release pull request open ("chore(master): release
X.Y.Z"): `feat` raises the minor version, `fix` the patch version, a `!`
breaking change the minor version while Brooz is 0.x. It writes the version
into `package.json` and `.release-please-manifest.json` and generates the
version's section of `CHANGELOG.md`.

Merging the release PR runs the rest of `.github/workflows/release.yml`
without a click: release-please tags `vX.Y.Z` and creates the GitHub release
as a draft; the installers are built on macOS, Windows and Linux; every
packaged app is launched once in smoke-test mode (`npm run smoke`, see
`src/main/smoke.ts`); and only when all three pass are the installers
attested, attached and the release published. electron-updater only sees
published releases, so a failed build or smoke test never reaches a user -
the release stays a draft, and `workflow_dispatch` with its tag retries it.

Never push a version tag by hand, never edit the version in `package.json`
outside the release PR, and keep commit types honest: they decide the next
version and the release notes.

## Architecture

The zones are declared in `.fallowrc.jsonc` and enforced by
`npm run lint`. A violation fails the build.

| Zone      | Files                   | May import                 |
| --------- | ----------------------- | -------------------------- |
| `shared`  | `src/shared/**`         | `shared`                   |
| `main`    | `src/main/**`           | `main`, `shared`           |
| `preload` | `src/preload/**`        | `shared`                   |
| `tiles`   | `src/renderer/tiles/**` | `tiles`, `shell`, `shared` |
| `shell`   | `src/renderer/**`       | `shell`, `tiles`, `shared` |
| `tests`   | `tests/**`              | all source zones           |
| `tooling` | `scripts/**`            | nothing                    |

The shell is organised by concern: `shell/grid` (the dome geometry, the
motion engine, the grid component), `shell/command` (the ask bar, the
rules, the model worker), `shell/glass` (the backdrop and the glass card)
and `shell/kit` (what several tiles share: seeded mock data, tile and live
chrome, icons, the data hooks). A tile imports from `shell/kit` and
`shell/tile.ts`; the kit never imports the registry, so there is no cycle.

Two package rules ride on top, enforced by oxlint overrides in
`vite.config.ts`: `shared` and the whole renderer (`tiles`, `shell`) never
import `electron` or anything `node:*`; the preload imports only `electron`
besides `shared`, because it runs sandboxed.

### Security rules

Not negotiable, and pinned by unit tests:

- `BrowserWindow` is created with `contextIsolation: true`, `sandbox: true`,
  `nodeIntegration: false` (`src/main/window.ts`).
- The window denies every `window.open`, and navigation away from the app is
  prevented (`will-navigate`).
- The renderer is served over the `app://` protocol, never over `file://`.
  Every response carries the Content-Security-Policy (a worker takes its
  policy from its own response) and COOP/COEP (`src/main/protocol.ts`).
  The policy is `'self'` everywhere, plus `'wasm-unsafe-eval'` for the
  ONNX Runtime and `https://huggingface.co https://*.hf.co` in
  `connect-src` for the model weights. In dev mode the window loads the
  Vite dev server instead.
- The renderer fetches nothing from the internet itself: Open-Meteo is
  called by the main process (`src/main/open-meteo.ts`, 10 s timeout,
  bounded cache), and the IPC handlers validate every argument
  (`src/main/validate.ts`) before it reaches the network.
- Every IPC handler checks the sender frame's origin against the app.
- `session.setPermissionRequestHandler` defaults to deny; the allowlist is
  empty until a tile needs a permission (a camera tile adds `media`).
- Electron fuses are pinned in `electron-builder.yml` (`electronFuses`):
  RunAsNode off, NODE_OPTIONS off, inspector args off, only-load-from-asar,
  asar integrity, cookie encryption.

## The tile template

`src/renderer/tiles/about` is the smallest reference, `tiles/weather` a
complete one. A tile directory `src/renderer/tiles/<name>/` (camelCase, so
`<name>Tile` is an identifier) owns:

- `index.tsx`, which exports the tile's components as `export function`
  and the definition as `export const <name>Tile: TileDefinition = {...}`,
  typed `TileDefinition` from `src/renderer/shell/tile.ts`;
- any helper module of its own (`moonPhase/moon.ts`), and nothing else: a
  tile never imports from another tile, and it reaches the main process
  only through `window.brooz`.

A definition has:

- `id` and `title` - the id is what the ask bar routes to (`'air-quality'`);
- `Component` - the resting tile, rendered from a per-cell `seed`. It is
  deterministic: no `Math.random`, no `Date`, no timer;
- `Live` (optional) - the summoned tile with real data, and `liveKey`,
  which decides from the utterance's args when it remounts;
- `route` (optional) - a description for the model, keywords, examples, the
  rule pattern and its weight, and `args`, which keeps the utterance's args
  the tile understands. A tile without a route is never summoned.

A new tile is registered in `src/renderer/tiles/index.ts`; its position in
the list is its place in the grid pattern. A tile that is missing there is
dead code - fallow reports its unused export.

`scripts/check-template.mjs` enforces the naming and the isolation, fallow
enforces the zones and the coverage. The routing benchmarks in
`tests/fixtures/routing.ts` must still pass after a change to a route.

## Adding an IPC channel

1. Add the channel to the contract in `src/shared/ipc.ts`: a name in
   `IPC_CHANNELS`, and its `args` and `result` in `IpcContract`.
2. Handle it in `src/main/ipc.ts`, with the sender check.
3. Cover it with a test. The preload needs no change - it is generic.

The renderer calls `window.brooz.invoke('<channel>', ...)`; the preload
rejects every channel that is not in the contract. The renderer is
untrusted input: validate the args in the handler before they reach the
file system or the network, with a parser in `src/main/validate.ts` (see
`parsePlaceQuery`).

The channels: `brooz:app-version`, `brooz:geocode`, `brooz:weather`,
`brooz:air-quality`, the key channels `brooz:key-set`, `brooz:key-delete`,
`brooz:key-status` and `brooz:key-test`, and the provider channel
`brooz:stock-quotes`.

## Provider keys

Tiles that need a keyed service never see its key: the renderer invokes a
provider channel, the main process holds the key and makes the request
(`docs/adr/0001-provider-keys-never-reach-the-renderer.md`). Keys belong to
a _provider_ of the manifest in `src/shared/providers.ts` (today: Finnhub),
never to a tile. The key channels are write-only - the renderer can set,
delete and ask for the status of a key, but no channel returns one. The
keys live encrypted under `userData` through `safeStorage`, and the app
fails closed where the OS offers no encryption
(`docs/adr/0002-safe-storage-fail-closed.md`). A provider channel answers
with the union `ok | missing-key | provider-error` instead of throwing, so
every tile handles the invitation to the settings. The settings tile
(`src/renderer/tiles/settings`) is the only surface that takes a key; a
tile without one renders that invitation, never an input of its own.

## The local model

The ask bar's model runs in a Web Worker (`shell/command/model-worker.ts`,
with the testable host in `model-host.ts`); `use-local-model.ts` talks to
it by message. The ONNX Runtime files ship with the app (`?url` imports of
`onnxruntime-web`, `env.useWasmCache = false`, so no `blob:` copies); only
the weights come from the Hugging Face hub, and Transformers.js keeps them
in CacheStorage after the first start. The model is opt-in: nothing is
downloaded until the person clicks "Enable local model" under the ask bar,
and the choice is remembered (`brooz.model.enabled` in localStorage). A
worker that fails to start reports an error instead of hanging. The CSP and
COOP/COEP that this needs are in place (see the security rules).

A future ML tile follows the same pattern inside its own tile directory.
A tile that needs the camera adds `media` to the permission allowlist.

## Code style

- Four spaces, semicolons, single quotes, print width 100, no trailing
  commas (`vp fmt` checks it).
- Public functions are declared with `export function`. Never `export const`
  arrow functions, and there are no default exports.
- A type that appears in a public signature is exported.

## Commit convention

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), with
the type first and no emoji: `feat: ...`, `fix: ...`, `chore: ...`,
`docs: ...`, `ci: ...`. release-please parses them, so a subject that does not
start with a type is invisible to the release. Keep the subject line short
and put the why in the body.

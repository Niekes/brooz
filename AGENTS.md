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
npm run verify   # typecheck + lint + the unit suite with coverage, the gate before a commit
npm run ui:add -- <name>  # add or update a shadcn primitive, and re-lock its hash
npm run bench:model # the real local model on the routing benchmarks (downloads ~380 MB once)
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
`main` and keeps one release pull request open ("chore(main): release
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

| Zone         | Files                                 | May import                       |
| ------------ | ------------------------------------- | -------------------------------- |
| `shared`     | `src/shared/**`                       | `shared`                         |
| `main`       | `src/main/**`                         | `main`, `shared`                 |
| `preload`    | `src/preload/**`                      | `shared`                         |
| `primitives` | `src/renderer/shell/ui/primitives/**` | `primitives`                     |
| `ui`         | `src/renderer/shell/ui/app-*.tsx`     | `primitives`                     |
| `tiles`      | `src/renderer/tiles/**`               | `tiles`, `shell`, `ui`, `shared` |
| `shell`      | `src/renderer/**`                     | `shell`, `tiles`, `ui`, `shared` |
| `tests`      | `tests/**`                            | all source zones                 |
| `tooling`    | `scripts/**`                          | nothing                          |

The shell is organised by concern: `shell/grid` (the dome geometry, the
motion engine, the grid component), `shell/command` (the ask bar, the
rules, the model worker), `shell/glass` (the backdrop and the glass card),
`shell/kit` (what several tiles share: seeded mock data, tile and live
chrome, icons, the data hooks), `shell/settings` (the settings overlay) and
`shell/ui` (the shadcn primitives and their `app-*` wrappers). A tile imports from `shell/kit` and
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
  ONNX Runtime, `https://huggingface.co https://*.hf.co` in
  `connect-src` for the model weights, and a per-launch nonce in
  `style-src` for the settings dialog's scroll lock (`brooz:style-nonce`
  hands it to get-nonce). In dev mode the window loads the
  Vite dev server instead.
- The renderer fetches nothing from the internet itself: OpenWeatherMap,
  Finnhub and the Open-Meteo geocoder are called by the main process
  (`src/main/openweathermap.ts`, `src/main/finnhub.ts`,
  `src/main/open-meteo.ts`, 10 s timeout, bounded cache), and the IPC handlers validate every argument
  (`src/main/validate.ts`) before it reaches the network.
- Every IPC handler checks the sender frame's origin against the app.
- `session.setPermissionRequestHandler` defaults to deny; the allowlist
  holds `geolocation` alone, for the weather tiles' device location
  (`docs/adr/0005-the-app-may-ask-for-the-device-location.md`). A camera
  tile would add `media`.
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
- any helper module of its own, and nothing else: a tile never imports from
  another tile, and it reaches the main process only through `window.brooz`.

A definition has:

- `id` and `title` - the id is what the ask bar routes to (`'air-quality'`);
- `Component` - the resting tile, rendered from a per-cell `seed`. It is
  deterministic: no `Math.random`, no `Date`, no timer;
- `Live` (optional) - the summoned tile, which receives the unwrapped `data`
  and renders only its content; `liveKey` decides from the utterance's args
  when it remounts. The shell owns the live chrome (status row, loading,
  error, missing key), see `docs/adr/0010`;
- `liveData` (with `Live`) - loads the live data over the chosen provider's
  channel and returns the loader the shell renders;
- `route` (optional) - a description for the model, keywords, examples, the
  rule pattern and its weight, and `args`, which keeps the utterance's args
  the tile understands. A tile without a route is never summoned;
- `providers` (optional) - the candidate providers with the channel each
  serves the tile through; the person picks the active one in the tile's
  settings section (`docs/adr/0011`);
- `place` / `ownPlace` (optional) - the tile shows a place: `place` tiles
  (weather, air quality) can save their own location in their settings
  section, `ownPlace` tiles (today surf) own a place of their own (the surf
  spot) - both appear in the tile's section (`docs/adr/0014`).

The settings list General, then one section per registered tile, then the
providers; the start tile setting in General picks which tile the grid
centers on at launch (`docs/adr/0015`).

A new tile is registered in `src/renderer/tiles/index.ts`; the slots nearest
the grid's center carry the registry in order, and every other slot shows the
default tile (`docs/adr/0009`). Use the create-tile skill
(`.agents/skills/create-tile`) to scaffold one. A tile that is missing from
the registry is dead code - fallow reports its unused export.

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

The channels: `brooz:app-version`, `brooz:geocode`, `brooz:style-nonce`,
the key channels `brooz:key-set`, `brooz:key-delete`, `brooz:key-status`,
`brooz:key-test` and `brooz:key-page` (opens the provider's key page in the
system browser, `docs/adr/0016`), and the provider channels `brooz:weather`,
`brooz:air-quality`, `brooz:stock-quotes`, `brooz:surf` and `brooz:flight-states`.

## Provider keys

Tiles that need a keyed service never see its key: the renderer invokes a
provider channel, the main process holds the key and makes the request
(`docs/adr/0001-provider-keys-never-reach-the-renderer.md`). Keys belong to
a _provider_ of the manifest in `src/shared/providers.ts` (today:
OpenWeatherMap, Finnhub, Stormglass and OpenSky Network), never to a tile. The key channels are write-only - the renderer can set,
delete and ask for the status of a key, but no channel returns one. The
keys live encrypted under `userData` through `safeStorage`, and the app
fails closed where the OS offers no encryption
(`docs/adr/0002-safe-storage-fail-closed.md`). A provider channel answers
with the union `ok | missing-key | provider-error` instead of throwing, so
every tile handles the invitation to the settings. The settings overlay
(`src/renderer/shell/settings`, ⌘, or Ctrl+,) is the only surface that
takes a key: a general section first, for the person's own choices (start
tile, device location, default location, temperature unit), then - under a
separator - one section per registered tile with its own settings (its own
location, its own place like the surf spot, its provider choice), then -
under another separator - one section per provider of the manifest, in
manifest order, each with its mark, the tiles it serves and its key - even
when it serves no tile yet (docs/adr/0014). A
key shows once per provider, however many tiles it serves. A tile without its key renders that invitation, never an
input of its own.

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

## The shadcn primitives

`src/renderer/shell/ui/primitives/` holds the shadcn components exactly as
generated (`docs/adr/0004-shadcn-primitives-are-untouched.md`). Never edit
them: style and extend them in an `app-*` wrapper next to them, the only
files that may import a primitive (fallow's `primitives` zone). Their hashes
are locked in `primitives.lock.json`; `npm run lint` fails on any drift, and
`npm run ui:add -- <name>` is the only way to add or update one. Every
primitive must be reached from an `app-*` wrapper, directly or through
another primitive; one that nothing reaches fails the lint.

## Hooks: ahooks first

A hook over a browser API or a timer that `ahooks` offers is taken from
there, never written again: `useInterval`, `useTimeout`, `useEventListener`,
`useKeyPress`, `useDebounce` and the rest of its export list
(`node_modules/ahooks/lib/index.d.ts`). Three hooks live in
`shell/kit/browser.ts` instead
(`docs/adr/0008-ahooks-replaces-usehooks.md`): `useGeolocation` and
`useMediaQuery`, which ahooks lacks, and `useStoredValue`, the one way to
keep a value in localStorage - it wraps ahooks' `useLocalStorageState` with
`listenStorageChange`, so every component reading a key follows a write.
App data loading (`useAsync` in `shell/kit/hooks.ts`) is not a browser hook
and stays ours. A timeout that restarts when a value changes stays a
`useEffect`: ahooks' `useTimeout` only restarts when its delay changes.

oxlint enforces this in `src/renderer/**`: `localStorage`,
`sessionStorage`, `matchMedia`, `navigator.geolocation` and ahooks'
storage hooks fail the lint with the hook to use instead; `browser.ts` is
the one module allowed to touch them.

## Code style

- Four spaces, semicolons, single quotes, print width 100, no trailing
  commas (`vp fmt` checks it).
- Public functions are declared with `export function`. Never `export const`
  arrow functions, and there are no default exports.
- A type that appears in a public signature is exported.
- The cursor follows the element's role, from one rule in
  `src/renderer/styles.css`: buttons and clickable roles point, text inputs
  take text, disabled controls are not-allowed. Never set `cursor-pointer`,
  `cursor-text`, `cursor-default` or `cursor-not-allowed` by hand; the lint
  fails on them. Special cursors such as `cursor-grab` stay free.
- Tailwind classes are canonical: `bg-white/3`, not `bg-white/[0.03]`; `size-4`, not
  `h-4 w-4`. oxlint enforces it through `eslint-plugin-better-tailwindcss`, against the
  theme in `src/renderer/styles.css`; `npx vp lint --fix` rewrites them. A theme token is
  taken only where it also means the right thing: the dialog's backdrop is `neutral-950`,
  not `primary-foreground`, though both are `#0a0a0a`.

## Commit convention

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), with
the type first and no emoji: `feat: ...`, `fix: ...`, `chore: ...`,
`docs: ...`, `ci: ...`. release-please parses them, so a subject that does not
start with a type is invisible to the release. Keep the subject line short
and put the why in the body.

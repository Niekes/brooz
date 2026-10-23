# brooz

brooz is an open-source desktop app built on Electron: a dashboard grid in
which every cell is a small app of its own - a tile. The roadmap runs towards
tiles that run local models (Transformers.js, OpenCV.js) in the browser.

The repository is the scaffold plus the machinery that keeps it in shape:
zoned architecture, a template check, fallow gates, 100% coverage, and a
release flow that publishes through a draft GitHub release.

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

A release is a pull request that bumps the version in `package.json` and
updates `CHANGELOG.md` (for example the `release/0.2.0` branch). Merging it
into `master` triggers `.github/workflows/release.yml`, which builds the
installers for macOS, Windows and Linux, attests them, and creates the
`vX.Y.Z` release on GitHub **as a draft**, with the version's section of
`CHANGELOG.md` as its notes.

The draft is the approval step: electron-updater only ever sees published
releases, so nothing reaches users until a maintainer has downloaded the
draft, tested it and clicked publish. Never push a version tag by hand and
never publish a release from the command line - the draft is the gate.

## Architecture

The zones are declared in `.fallowrc.jsonc` and enforced by
`npm run lint`. A violation fails the build.

| Zone      | Files                   | May import                      |
| --------- | ----------------------- | ------------------------------- |
| `shared`  | `src/shared/**`         | `shared`                        |
| `main`    | `src/main/**`           | `main`, `shared`                |
| `preload` | `src/preload/**`        | `shared`                        |
| `tiles`   | `src/renderer/tiles/**` | `tiles`, `shell`, `shared`      |
| `shell`   | `src/renderer/**`       | `shell`, `tiles`, `shared`      |
| `tests`   | `tests/**`              | all source zones                |
| `e2e`     | `e2e/**`                | nothing, it launches the binary |
| `tooling` | `scripts/**`            | nothing                         |

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
- The renderer is served over the `app://` protocol with a
  Content-Security-Policy header, never over `file://`. In dev mode the
  window loads the Vite dev server instead.
- Every IPC handler checks the sender frame's origin against the app.
- `session.setPermissionRequestHandler` defaults to deny; the allowlist is
  empty until a tile needs a permission (a camera tile adds `media`).
- Electron fuses are pinned in `electron-builder.yml`: RunAsNode off,
  NODE_OPTIONS off, inspector args off, only-load-from-asar, asar integrity,
  cookie encryption.

## The tile template

`src/renderer/tiles/about` is the reference. A tile directory
`src/renderer/tiles/<name>/` owns:

- `index.tsx`, which exports the tile's component as `export function` and
  the definition as `export const <name>Tile: TileDefinition = {...}` -
  camelCase, typed `TileDefinition` from `src/renderer/shell/tile.ts`;
- nothing else: a tile never imports from another tile, and it reaches the
  main process only through `window.brooz`.

A new tile is registered in `src/renderer/tiles/index.ts`. A tile that is
missing there is dead code - fallow reports its unused export.

`scripts/check-template.mjs` enforces the naming and the isolation, fallow
enforces the zones and the coverage.

## Adding an IPC channel

1. Add the channel to the contract in `src/shared/ipc.ts`: a name in
   `IPC_CHANNELS`, and its `args` and `result` in `IpcContract`.
2. Handle it in `src/main/ipc.ts`, with the sender check.
3. Cover it with a test. The preload needs no change - it is generic.

The renderer calls `window.brooz.invoke('<channel>', ...)`; the preload
rejects every channel that is not in the contract.

## ML tiles

The first ML tile runs its inference in a Web Worker inside its own tile
directory. Two things change when it lands, both in `src/main/protocol.ts`:

- the CSP header grows `'wasm-unsafe-eval'` for the WebAssembly runtime;
- the responses for the shell document grow COOP/COEP headers, because WASM
  threads need `SharedArrayBuffer`.

A tile that needs the camera adds `media` to the permission allowlist.

## Code style

- Four spaces, semicolons, single quotes, print width 100, no trailing
  commas (`vp fmt` checks it).
- Public functions are declared with `export function`. Never `export const`
  arrow functions, and there are no default exports.
- A type that appears in a public signature is exported.

## Commit convention

Emoji plus Conventional Commits, the same convention as
[d3-3d](https://github.com/Niekes/d3-3d): `🔧 chore: ...`, `✨ feat: ...`,
`🐛 fix: ...`. Keep the subject line short and put the why in the body.

# Contributing to brooz

Thanks for taking the time to contribute. brooz is maintained by one person
in spare time, so every pull request that saves a day of debugging is worth
a lot.

## Getting started

```bash
git clone https://github.com/Niekes/brooz.git
cd brooz
npm install
npm run dev
```

Node 22, 24 or newer is required.

## The checks that have to pass

```bash
npm run lint     # the whole gate
npm test         # the unit suite
npm run build    # typecheck + renderer build + electron bundles
```

`npm run lint` runs four things:

- `vp fmt --check` checks the formatting,
- `vp lint` runs oxlint, including the zone import rules,
- `npm run lint:template` checks the tile template in
  [AGENTS.md](./AGENTS.md),
- `npm run lint:fallow` checks zones, dead code, coverage gaps and
  duplication.

All of them run in CI on every pull request, so running them locally saves
you a round trip. Coverage thresholds are 100%: a fresh repository is the
cheapest moment to hold that line.

## Repository layout

| Path                    | Zone      | What lives there                                  |
| ----------------------- | --------- | ------------------------------------------------- |
| `src/shared/**`         | `shared`  | The typed IPC contract. The only shared file.     |
| `src/main/**`           | `main`    | The Electron main process.                        |
| `src/preload/**`        | `preload` | The sandboxed bridge: `window.brooz`.             |
| `src/renderer/tiles/**` | `tiles`   | One directory per tile, isolated from each other. |
| `src/renderer/**`       | `shell`   | The dashboard grid and the renderer entry.        |
| `tests/**`              | `tests`   | The unit suite, mirroring `src/`.                 |
| `e2e/**`                | `e2e`     | Playwright against `electron .`.                  |
| `scripts/**`            | `tooling` | Repository tooling. Imports nothing from the app. |

The renderer never imports Electron or Node. A tile never imports from
another tile. Everything is enforced, not convention - see the zone table in
[AGENTS.md](./AGENTS.md).

## Adding a tile

1. Create `src/renderer/tiles/<name>/index.tsx` following
   `src/renderer/tiles/about` - the reference tile.
2. Register it in `src/renderer/tiles/index.ts`.
3. Add a test under `tests/renderer/`.
4. Run `npm run lint` and `npm test`.

## Adding an IPC channel

1. Add the channel to the contract in `src/shared/ipc.ts`.
2. Handle it in `src/main/ipc.ts`, with the sender check.
3. Cover the handler with a test. The preload needs no change.

## Code style

- Four spaces, semicolons, single quotes, print width 100, no trailing
  commas.
- Public functions are declared with `export function`. Never `export const`
  arrow functions, and there are no default exports.
- Every new public export needs a test that reaches it.

## Pull requests

- Keep them focused. One tile or one fix per pull request makes review
  fast.
- Open an issue first for anything larger than a bug fix, so the approach
  can be agreed on before you write the code.
- Make sure `npm run lint`, `npm test` and `npm run build` pass locally,
  and `npm run test:e2e` when you touched the main process or the shell.

## Releasing

A release is a pull request that bumps the version in `package.json` and
updates `CHANGELOG.md` - for example the `release/0.2.0` branch. Merging it
into `master` starts it: the
[Release workflow](.github/workflows/release.yml) builds the installers,
attests them and creates the `vX.Y.Z` release on GitHub **as a draft**, with
the version's section of `CHANGELOG.md` as its notes. A maintainer then
downloads the draft, tests it and clicks publish - only then the tag exists
and users and the auto-updater see the release. Do not push a version tag
by hand and do not publish a release from the command line.

## Reporting bugs

Open an issue with the
[bug report template](https://github.com/Niekes/brooz/issues/new/choose).
The About tile shows the version - a reproduction from launch to problem is
worth more than a description.

## Support

brooz is free and always will be. If it is useful to you and you want to help
keep it maintained, [become a sponsor](https://github.com/sponsors/niekes).

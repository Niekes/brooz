---
name: create-tile
description: Scaffold a new dashboard tile, or upgrade one (a Live state, a route, a provider). Asks whether the tile needs a provider and which, then generates the tile directory on the shared shell chrome and registers it. Use when the user wants to add a tile to brooz or extend an existing tile.
---

Scaffold a new tile for the brooz dashboard. The tile is code, not a runtime
addition: it lands in `src/renderer/tiles/<name>/` and in the registry, and
the default tile in the grid shrinks by one slot. Upgrading a tile - adding
`Live`, a route or a provider to an existing one - re-enters this flow at
that step.

## Ask first

1. **Name**: camelCase directory name, so `<name>Tile` is an identifier
   (e.g. `habitTracker`). Title for people, and one sentence on what the
   tile does.
2. **Provider**: does the live data come from a provider of the manifest
   (`src/shared/providers.ts`)?
    - Yes, an existing one -> which channel serves the tile
      (`brooz:weather`, `brooz:air-quality`, `brooz:stock-quotes`)?
    - No -> the tile is resting-only (like `about`), or it needs a **new
      provider**: then the checklist below applies.
    - Several candidates -> list them all in `providers`; the person picks
      the active one in the provider's settings section (ADR 0011).
    - The service signs in with OAuth, IMAP or any account login instead of
      a plain API key (a Mail tile, say) -> stop before any code: a
      provider is one key in `safeStorage` (ADR 0001, ADR 0002), and
      extending that model takes an ADR in `docs/adr/` first.
3. **Route**: should the ask bar summon it? If yes, ask for 2-3 example
   utterances; derive keywords and the rule pattern from them, and set a
   weight (3-3.5 like the existing routes). Add benchmark cases to
   `tests/fixtures/routing.ts` (the development set and the holdout sets),
   then run `npm run bench:model` - mandatory for any route change, it is
   the only check that the model summons the tile; the rules half already
   runs in `npm run verify`.

## New provider checklist (only when the answer above needs one)

1. `src/shared/providers.ts`: the `ProviderInfo` and the manifest entry.
2. `src/shared/ipc.ts`: the channel in `IPC_CHANNELS` and `IpcContract`.
3. `src/main/ipc.ts`: the handler with the sender check; validate args in
   `src/main/validate.ts`.
4. The main-process client (like `src/main/openweathermap.ts`): 10 s
   timeout, bounded cache, `ProviderOutcome` union, never a throw.
5. `ProviderIcon` in `shell/kit/icons.tsx`; a settings section appears on
   its own.
6. Tests for the contract, the handler, the validator and the client.

## Generate

Create `src/renderer/tiles/<name>/index.tsx` from this shape:

- `export function <Name>({ seed }: TileProps)` - the resting tile, fully
  seeded (`shell/kit/seed.ts`): no `Math.random`, no `Date`, no timer.
- With a provider: `liveData(args, channel)` returning a `LiveLoader<T>` -
  use `usePlaceData` for a place-based tile, `useProviderData` otherwise -
  and `export function Live<Name>({ args, data }: LiveTileProps<T>)` which
  renders **only the content**. The shell owns the status row, loading,
  error and missing-key overlays (ADR 0010); never import `LiveFrame` or
  `ProviderData` in a tile.
- `providers: [{ provider: X, channel: 'brooz:...' }]` per candidate; with
  more than one, the tile's settings section gets a provider radio
  (ADR 0011).
- `place: true` when the tile shows a place - it then gets its own location
  option in its settings section (ADR 0014); `ownPlace: true` when it owns a
  place of its own (like the surf spot).
- `route` when summonable; `liveKey` from the args that change the data.
- `export const <name>Tile: TileDefinition<T> = {...}`.

Then register it in `src/renderer/tiles/index.ts` (registry order = placement
from the grid center outward, ADR 0009). The tile appears in the settings
between General and the providers, and in the start-tile picker in General
(ADR 0014, ADR 0015).

## Finish

- `scripts/check-template.mjs` must pass (naming, no cross-tile imports).
- Add tests in `tests/renderer/`: resting render over seeds, `liveData`,
  `Live` content, and the slot chrome via `live-slot.test.tsx` patterns.
  Coverage is 100%: every new line needs a test.
- Run `npm run verify` (typecheck + lint + tests with coverage) and
  `fallow audit --format json --quiet --explain --gate-marker agent`.
- Commit with a Conventional Commits subject: `feat: add the <name> tile`.

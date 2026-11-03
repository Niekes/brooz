# The start tile is centered and highlighted on launch

General has a "Start tile" setting: one radio per registered tile, stored as
`brooz.start.tile`, default `about`. When the app opens, the grid centers on
that tile's slot and highlights it for the usual 650 ms. It is not summoned
live - no provider request fires at startup, and the default (About) needs no
key. An unknown stored id falls back to About, then to the first registered
tile.

## Considered options

- Summon the start tile live on launch: rejected - a weather start tile would
  spend a provider request on every cold start, before the person asked for
  anything; centering is the visible part of "loaded".
- A fixed start tile in code: rejected - the person should pick it; About is
  the safe default because it needs nothing.

## Consequences

- `useStartTileCenter` in `shell/grid/infinite-grid.tsx` runs once when the
  first pool is there; the highlight reuses the summon highlight.
- The setting lives in General and lists the registry, so new tiles from the
  create-tile skill appear in it automatically.

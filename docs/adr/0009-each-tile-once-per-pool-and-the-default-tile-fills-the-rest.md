# Each tile sits once per pool; the default tile fills the rest

The dashboard grid is infinite - a finite pool of slots wraps around the
viewport like a torus - so a slot policy has to say what a slot shows when
no tile claims it. We decided: the slots nearest the pool's center carry the
registered tiles in registry order, exactly one slot each, and every other
slot shows the default tile, a placeholder that is not in the registry and
cannot be summoned. A click on it opens the settings.

## Considered options

- Modulo repetition (`tiles[(row*5 + col*3) % count]`), the original policy:
  rejected - with few tiles every cell repeats the same tile, and "each tile
  once" becomes impossible to see.
- Empty glass cells for unclaimed slots: rejected - a grid of empty cells
  looks broken, not minimal; the default tile says what it is and where to
  add real tiles.
- A runtime list of active tiles the person edits: rejected - tiles are code
  (a tile missing from the registry is dead code), so "adding a tile" is a
  code-time act (the create-tile skill), not a runtime one.

## Consequences

- `tileIndexAt` ranks slots by wrapped distance from the pool's center and
  hands ranks `0..count-1` to the registry in order; every other slot -
  including slots outside the pool - is the default tile (`DEFAULT_TILE`).
- The grid is never empty: with zero registered tiles every slot is the
  default tile, so there is no hard minimum to enforce.
- A summoned tile flies to the one slot of its kind; `nearestOf` no longer
  has to search among repeats.

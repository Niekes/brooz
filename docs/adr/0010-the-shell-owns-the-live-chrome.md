# The shell owns the live chrome; tiles render only their content

A summoned tile used to carry its own status: every live tile wrapped itself
in a frame with the tile name, the provider meta and the low-confidence
badge, and rendered its own skeleton, error and missing-key states. We
decided: the grid shell owns all of that. `LiveSlot` (`shell/grid`) resolves
the tile's chosen provider, calls the tile's `liveData` loader, and renders
the status row plus the loading, error and missing-key overlays; the tile's
`Live` component receives the unwrapped `data` and renders only its content.

## Considered options

- Chrome per tile (the old `LiveFrame`/`ProviderData` in every tile):
  rejected - the same status row and overlays were re-implemented per tile,
  and a new tile had to know the whole protocol.
- Only the status row in the shell, outcomes still per tile: rejected -
  the overlay is where a tile most needs help (missing key, error, retry),
  so it belongs to the one place that owns the provider union.

## Consequences

- A tile definition's `liveData(args, channel)` loads over the chosen
  provider's channel and returns a `LiveLoader` (the outcome state, plus
  `pending` and `notice` for the states that never reach the network, like an
  unresolved device location). The shell calls it while the tile is
  summoned, so it may use hooks.
- `LiveTileProps` is `{ args, data }`: no label, no low-confidence flag -
  both live in the shell's status row now, above the tile content.
- The kit's `live.tsx` keeps the chrome components (`LiveFrame`,
  `ProviderData`, `NeedsSetting`, the skeleton and error overlays); they are
  used by the shell, not by tiles. This is the scaffold the create-tile skill
  builds on. (The skeleton stays module-private; `ProviderData` renders it.)

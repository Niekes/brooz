# A tile with several candidate providers chooses in the provider's settings section

A tile declares the providers whose keys its live data can use, each with the
IPC channel it serves the tile through (`providers: TileProvider[]`), and the
first candidate is the default. When a tile lists more than one, the person
picks the active one in the settings - inside the provider's own section, as
a per-tile radio - and the choice is stored per tile as
`brooz.tile.<id>.provider`.

## Considered options

- A section per tile for the choice: rejected - the glossary keys settings
  sections by provider, never by tile, and a key belongs to a provider;
  keeping the choice inside the provider's section preserves both rules.
- The choice inside the live tile: rejected - the settings are the one
  surface for keys and options, and a tile that switches its own data source
  blurs ADR 0001 ("keys belong to a provider, never to a tile").
- A runtime re-assignment of providers to tiles: rejected - the manifest and
  the tile's candidates are code; only the choice between declared candidates
  is a stored setting.

## Consequences

- `useChosenProvider` reads the stored id and falls back to the first
  candidate when it is missing or no longer a candidate; the shell loads the
  live data over the chosen provider's channel.
- A missing key shows the missing-key overlay for the chosen provider; there
  is no silent fallback to another candidate.
- Every provider of the manifest has a settings section even when it serves
  no tile yet, so its key has a place before any tile uses it.
- Secondary calls a tile makes for its own content (like the weather card's
  air-quality dot) use that provider's own channel directly; the chosen
  provider's channel is the one the tile's `liveData` loads through.

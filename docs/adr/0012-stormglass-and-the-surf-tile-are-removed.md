# Stormglass and the surf tile are removed

Status: superseded by this ADR - see `0007` for the history.

The dashboard keeps two providers, OpenWeatherMap and Finnhub, and the tiles
that serve them (weather, air quality, markets). Stormglass, the surf tile,
the `brooz:surf` channel, the surf spot setting and the main-process client
are removed, so the manifest in `src/shared/providers.ts` is the whole list
of keyed services.

## Considered options

- Keep Stormglass for the surf tile: rejected - the session's goal is a small
  dashboard of keyed tiles, and a third provider with its own budget (10
  requests a day, ADR 0007) serves one tile.
- Keep the tile, drop the provider: rejected - the tile's live data would have
  no source, and a resting-only tile in the registry is a mock, not an app.

## Consequences

- ADR 0007 (Stormglass budgeting and caching) is superseded: nothing budgets
  or caches Stormglass requests anymore, and `src/main/stormglass.ts` is gone.
- The surf spot setting goes with the tile; the default location stays for
  the weather tiles.
- A future surf tile follows the create-tile skill: a new provider in the
  manifest, a main-process client with validation, and a tile that declares
  the provider and its channel.

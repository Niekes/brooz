# Brooz

The language of the dashboard: the cells on the dome, the external services
behind their live data, and the settings that configure both.

## Language

**Tile**:
One cell of the dashboard grid - a small app of its own, with a resting state
and an optional live one.
_Avoid_: widget, card, cell

**Provider**:
An external service a tile's live data can come from, and the unit of an API
key: several tiles may share one.
_Avoid_: service, API, backend, key source

**Settings section**:
One entry of the settings sidebar: General, or one provider of the manifest
with its key. A section is keyed by provider, never by tile, and exists even
when the provider serves no tile yet.
_Avoid_: tab, page, panel

**API key**:
The credential that unlocks a provider's data for the tiles that need it.
_Avoid_: token, secret, password

**Default tile**:
The placeholder cell that fills every grid slot without a registered tile, so the grid is never empty. It is not in the registry and cannot be summoned; a click opens the settings.
_Avoid_: empty cell, spacer, filler

**Chosen provider**:
The one provider of a tile's candidates that is active, stored per tile as `brooz.tile.<id>.provider` and picked in the provider's settings section.
_Avoid_: selected service, active source

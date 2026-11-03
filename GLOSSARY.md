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
with its key. A section is keyed by provider, never by tile.
_Avoid_: tab, page, panel

**API key**:
The credential that unlocks a provider's data for the tiles that need it.
_Avoid_: token, secret, password

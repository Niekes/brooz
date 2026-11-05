# Brooz

The language of the dashboard: the cells on the dome, the external services
behind their live data, and the settings that configure both.

## Language

**Tile**:
One cell of the dashboard grid - a small app of its own, with a resting state
and an optional live one.
_Avoid_: widget, card, cell

**Route**:
The ask bar's path from an utterance to a tile, scored by the deterministic
rules and the local model. A tile without a route is never summoned.
_Avoid_: intent, command, matcher

**Utterance**:
The English sentence a person types into the ask bar, routed to a tile.
_Avoid_: query, prompt, command

**Argument**:
A value an utterance carries that a tile understands: a city, a ticker symbol, a flight number. The rules find them in the text, whichever router picks the tile.
_Avoid_: param, entity, slot

**Quick action**:
A saved utterance with an optional label, offered above the ask bar while the field is empty; picking one puts its utterance into the field to be routed like a typed one.
_Avoid_: chip, example, shortcut, preset

**Provider**:
An external service a tile's live data can come from, and the unit of an API
key: several tiles may share one.
_Avoid_: service, API, backend, key source

**Settings section**:
One entry of the settings sidebar: General, Quick actions, one per registered tile with its own settings, or one per provider of the manifest with its key. Quick actions follows General; tile sections sit between it and the providers; a provider section exists even when the provider serves no tile yet.
_Avoid_: tab, page, panel

**API key**:
The credential that unlocks a provider's data for the tiles that need it.
_Avoid_: token, secret, password

**Default tile**:
The placeholder cell that fills every grid slot without a registered tile, so the grid is never empty. It is not in the registry and cannot be summoned; a click opens the settings.
_Avoid_: empty cell, spacer, filler

**Start tile**:
The tile the dashboard centers and highlights on launch, picked in General's settings and stored as `brooz.start.tile`; About until set. It is highlighted, not summoned live.
_Avoid_: home tile, landing tile

**Tile location**:
The place a tile saved for itself in its own settings section (`brooz.tile.<id>.location`); empty means the tile follows the device location and the default location.
_Avoid_: per-tile place, own spot

**Surf spot**:
The one point on the water the surf tile forecasts; saved as `brooz.surf.spot` in the surf tile's settings section by its town and its coordinates.
_Avoid_: favorite, break

**Rating**:
The surf tile's verdict for an hour - great, good, fair or poor - computed from wave height, swell period and wind, because the provider has no rating of its own.
_Avoid_: status, grade, score

**Best window**:
The contiguous hours with the highest average rating, shown as the surf tile's best-surf line.
_Avoid_: peak hours, best time

**Chosen provider**:
The one provider of a tile's candidates that is active, stored per tile as `brooz.tile.<id>.provider` and picked in the tile's settings section.
_Avoid_: selected service, active source

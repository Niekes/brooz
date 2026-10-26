# brooz

brooz is an infinite dashboard grid on a dome: every cell is a small app of
its own, and an ask bar routes an English utterance to a tile.

## Language

**Tile**:
A small app occupying one cell of the grid. Has a resting state rendered
from a per-cell seed, and optionally a live state with real data.
_Avoid_: Widget, gadget, applet

**Provider**:
An external service that a tile's live data comes from and that requires a
key to be used. Several tiles may share one provider.
_Avoid_: Service, integration, API (as a noun for the service)

**Key**:
The secret credential of exactly one provider. A key belongs to its
provider, never to a tile, and once stored it is not readable back from the
app.
_Avoid_: Token, secret, credential

**Settings**:
The single surface where keys are managed, shown as a list of providers.
_Avoid_: Preferences, config

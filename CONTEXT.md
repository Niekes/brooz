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

**Air quality category**:
The step a place's air is on right now, on OpenWeatherMap's five-step
index: Good, Fair, Moderate, Poor or Very poor. Every tile that speaks of
air quality uses this one scale.
_Avoid_: AQI level, US EPA category

**Settings**:
The single surface where keys and tile options are managed, shown over the
dashboard rather than as a tile of it. It is divided
into one section per tile; a tile whose provider needs a key shows that
provider's key in its section, so a key shared by several tiles appears in
each of their sections and is still one key.
_Avoid_: Preferences, config

**Section**:
The part of the settings that belongs to one tile, listed in the settings'
sidebar.
_Avoid_: Area, page, tab

**Location**:
The place a tile shows live data for. A city named in the utterance is the
location; without one, the device location is; without that, the default
location. Without any of them the tile has no location and asks for one.
_Avoid_: Place (for this meaning), position, city

**Default location**:
The place the person saves in the settings for a tile without a city to
show when there is no device location. There is at most one, shared by
every tile that shows a place.
_Avoid_: Home, fallback city, current location

**Device location**:
Where the device is right now, followed for as long as a tile uses it,
with the person's permission.
_Avoid_: Real-time location, GPS, current location

**Temperature unit**:
Celsius or Fahrenheit: the scale every temperature in the app is shown in.
One choice for the whole app, belonging to the person rather than to a
tile, so it appears in the section of each tile that shows temperatures and
is still one choice.
_Avoid_: Units, scale, metric/imperial

**Primitive**:
A UI component taken from shadcn exactly as generated. It is never changed
by hand and never used by the app directly, only through a wrapper.
_Avoid_: Base component, shadcn component, UI component

**Wrapper**:
The app's own component around one or more primitives: where the app's look
and behaviour live, and the only way the app uses a primitive.
_Avoid_: App component, styled component

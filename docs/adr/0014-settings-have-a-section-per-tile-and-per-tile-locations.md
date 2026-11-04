# Settings: a section per tile, and each tile can save its own location

The settings sidebar lists, in order: General (the person's own choices),
then one section per registered tile with that tile's settings, then - under
a separator - one section per provider with its key. A tile's section holds
what belongs to the tile: its own location (place-based tiles), its own place
(today the surf spot), and the provider picker when the tile has several
candidates (ADR 0011).

A place-based tile can save its own location as `brooz.tile.<id>.location`.
The fallback chain for a live tile is: the city of the utterance, else the
tile's own location, else the device location (while enabled), else the
general default location, else the tile asks for a location.

## Considered options

- Sections keyed by provider only (the old rule "a section is keyed by
  provider, never by tile"): rejected - the person thinks in tiles ("where
  does my weather look?"), and a tile's options next to its name are found
  faster than under the provider that happens to serve it.
- Per-tile locations only, no tile sections: rejected - the surf spot and the
  provider choice need a home that is not a provider's key section.
- Runtime editing of which tiles are registered: rejected - tiles are code
  (ADR 0009); the settings configure them, they do not add them.

## Consequences

- `tileSection` builds one section per registry entry; a tile without options
  shows a one-line note. New tiles from the create-tile skill appear
  automatically.
- The surf spot keeps its storage key `brooz.surf.spot`; it is rendered in
  the surf tile's section, so existing installs need no migration.
- GLOSSARY.md's "Settings section" is rewritten accordingly.

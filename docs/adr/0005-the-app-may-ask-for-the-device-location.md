# The app may ask for the device location

_The Berlin fallback is superseded by
[0006](0006-a-default-location-replaces-the-berlin-fallback.md); the rest stands._

The permission handler denies every request by default. `geolocation` is
the first and only exception: a weather tile summoned without a city
follows the device location (`watchPosition`, rounded to about a kilometre)
instead of a fixed city, because "the weather" means the weather where the
person is. The tile asks only when it needs it - a city named in the
utterance never touches the device location - and without one (denied,
switched off, or unsupported, as often on Linux) it falls back to Berlin
and says so on the tile, never silently. The person can turn the device
location off in the weather tiles' settings sections; the tiles then show
the fallback and never ask.

## Considered options

- Keep the allowlist empty and let the person name a home city in the
  settings: rejected - one more setting to maintain, and wrong as soon as
  the laptop travels.
- Ask once per launch (`getCurrentPosition`) instead of following: rejected -
  the person asked for the location that is current, and the bounded
  rounding keeps the reloads rare.
- Show no data without a device location: rejected - an empty tile helps
  less than a marked fallback.

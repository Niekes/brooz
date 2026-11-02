# A default location replaces the Berlin fallback

A tile without a city follows the device location (0005). Without one -
denied, switched off, or unsupported - it no longer shows Berlin. It shows
the default location the person saved in the settings, under the name they
saved, and without a default location it shows no data and asks for a
location ("Set a location first.") instead of guessing.

The default location is typed as a city and looked up once, on save, over
the existing geocode channel; the place found (name, country, coordinates)
is stored in the renderer's local storage. Tiles then ask for it by its
coordinates, so a city name is never looked up again and "which Paris" is
settled once, where the person can see it.

## Considered options

- Keep Berlin as the last step: rejected - a person outside Berlin sees
  another city's weather whenever the device location fails, often on
  Linux, and a marked fallback is still the wrong place.
- Put the default location before the device location: rejected - the
  device location is right more often, and the default takes over exactly
  when it is missing.
- Store the typed text and look it up on every request: rejected - a typo
  or the wrong Paris would surface in a tile instead of in the settings.

0005 rejected a home city ("wrong as soon as the laptop travels") and an
empty tile; both still hold as reasons to prefer the device location, which
stays first. The default location only replaces what came after it.

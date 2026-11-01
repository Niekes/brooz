# OpenWeatherMap replaces Open-Meteo, and live weather needs a key

All weather data (current weather, forecast, air quality) comes from
OpenWeatherMap's free API through a keyed provider, `openweathermap`. Only
geocoding stays on Open-Meteo's keyless geocoder: OpenWeatherMap's gives no
IANA time zone, which the world clock needs and the weather tiles use to
read times in the place's own zone. A fresh install therefore shows no live weather until
a key is entered - the weather tiles render the missing-key invitation
instead. We accept that regression for one source of truth and one code path,
instead of a keyless default plus a keyed upgrade.

## Considered options

- Keep Open-Meteo as the keyless fallback and switch to OpenWeatherMap once a
  key is set: rejected - two providers to map, test to 100% and explain, for
  a choice nobody asked to make.
- OpenWeatherMap One Call 3.0: rejected - it asks for a payment card even on
  the free tier.

## Consequences

- The free API forecasts in 3-hour steps; the main process folds them into
  days, so the shared weather contract keeps its daily shape.
- OpenWeatherMap's condition ids are mapped to the WMO codes the tiles
  already render.
- Air quality is OpenWeatherMap's own 1-5 index, not the European AQI: we
  show the provider's number rather than derive one of our own.
- A new key answers 401 for up to two hours; that 401 is reported as "not
  active yet", never as a wrong key.

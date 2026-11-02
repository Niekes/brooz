# Changelog

All notable changes to this project are documented in this file.

From 0.2.1 on, release-please writes the entries from the Conventional
Commits on `master`; the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0](https://github.com/Niekes/brooz/compare/v0.4.0...v0.5.0) (2026-11-02)


### Added

* a default location replaces the Berlin fallback ([1d7fc17](https://github.com/Niekes/brooz/commit/1d7fc17356778473e3c75515d80765100ef946a6))
* a general section in the settings for location and temperature unit ([3b5fff0](https://github.com/Niekes/brooz/commit/3b5fff000460a198b1101c3424b862a0cd41eb82))
* a general section in the settings for location and temperature unit ([dfeeb76](https://github.com/Niekes/brooz/commit/dfeeb769991683c92ddad5758459a791fc29f913))
* add a surf tile with the Stormglass forecast of a saved surf spot ([2223d11](https://github.com/Niekes/brooz/commit/2223d11ef1d86f75d7ca01933730ccf70805925d))
* add a surf tile with the Stormglass forecast of a saved surf spot ([08ee1d6](https://github.com/Niekes/brooz/commit/08ee1d65a3bf692e3b05ad33e28ee6c07962eb0f))
* choose Celsius or Fahrenheit in the settings ([d146332](https://github.com/Niekes/brooz/commit/d14633264ca39818434998dabe4c611c84812734))
* choose Celsius or Fahrenheit in the settings ([755d711](https://github.com/Niekes/brooz/commit/755d7113e2cb9b3493f0c25641b57edb628e99a8))
* redesign the weather tile and fold the forecast into it ([a3fc69c](https://github.com/Niekes/brooz/commit/a3fc69cd80115cfb50a9495b6077b10c00a79aa6))
* show the air quality category on the weather tile ([2985b52](https://github.com/Niekes/brooz/commit/2985b5258a028b0aed98e5d4c1db3ae60dc56c7c))
* unified weather tile, default location and air quality indicator ([b277d8a](https://github.com/Niekes/brooz/commit/b277d8a8e6c567ead00a31165b1bdc25aca4e2fa))


### Fixed

* the cursor follows the element's role ([f04b072](https://github.com/Niekes/brooz/commit/f04b07265871151ad3770d706e1ffc4f86fed174))
* the cursor follows the element's role ([abefa33](https://github.com/Niekes/brooz/commit/abefa33e9696b18a945ae02523856aa611fc3af7))
* the surf spot hook uses useStoredValue ([162f643](https://github.com/Niekes/brooz/commit/162f64309584750e9175a474a2ad7c9893f5b964))
* the surf spot hook uses useStoredValue ([2d5bd6a](https://github.com/Niekes/brooz/commit/2d5bd6a5a379055cf173611926904a0cf4a95675))

## [0.4.0](https://github.com/Niekes/brooz/compare/v0.3.0...v0.4.0) (2026-11-01)


### Added

* settings overlay, usehooks and the device location ([c5dd6a8](https://github.com/Niekes/brooz/commit/c5dd6a8a627d24229d9e08886537d6023dde4fd0))
* settings overlay, usehooks and the device location ([161872c](https://github.com/Niekes/brooz/commit/161872cf076f109621392a537fa27916f6d68930))


### Fixed

* drop the scroll area the CSP blocks ([39d37fc](https://github.com/Niekes/brooz/commit/39d37fc97184d16a0de7a51a7f41fe3ee1d98cd6))

## [0.3.0](https://github.com/Niekes/brooz/compare/v0.2.0...v0.3.0) (2026-10-26)


### Added

* live tiles behind provider keys, and a settings tile to manage them ([af59141](https://github.com/Niekes/brooz/commit/af591414897ff19a9aad4136585f761c7054d35c))
* live tiles behind provider keys, and a settings tile to manage them ([6a89e13](https://github.com/Niekes/brooz/commit/6a89e13345864a24b9779931508fc615bf193836))


### Fixed

* give up on weather requests after 10 seconds and bound the weather cache ([92030f8](https://github.com/Niekes/brooz/commit/92030f8fd95fa3916d751ba70a2d4b884335292a))
* make the local model opt-in, a fresh install downloads nothing until asked ([92030f8](https://github.com/Niekes/brooz/commit/92030f8fd95fa3916d751ba70a2d4b884335292a))
* report a model worker that cannot start instead of loading forever ([92030f8](https://github.com/Niekes/brooz/commit/92030f8fd95fa3916d751ba70a2d4b884335292a))

## [0.2.0] - 2026-10-24

### Added

- The dashboard: an infinite grid of glass tiles on a dome, panned by drag,
  wheel and glide, flat for reduced motion.
- Fourteen tiles from the niekes-dashboard prototype. Eight turn live when
  summoned: Analog Clock, World Clock, Weather, 5-Day Forecast, Air Quality,
  Moon Phase, Pomodoro and Sticky Note. Now Playing, Activity Rings, System
  Stats, Markets, Calendar and Photo show seeded demo data.
- The ask bar: an utterance summons its tile, by keyword rules or by a
  local decision model (open-jev) that runs in a Web Worker.
- Weather, forecast, air quality and geocoding from Open-Meteo, fetched by
  the main process over three new IPC channels.

### Changed

- The app is called Brooz: the window title, the macOS menu, the About
  tile and the installer names (`Brooz-<version>-arm64.dmg`, ...).
- The Content-Security-Policy allows WebAssembly and the Hugging Face hub
  for the model weights, and every response of the `app://` protocol now
  carries it, together with COOP/COEP headers.

## [0.1.0] - 2026-10-23

### Added

- The application scaffold: an Electron main process that serves the
  renderer over the `app://` protocol with a Content-Security-Policy
  header, a sandboxed preload bridge with a typed IPC contract, and a
  CSS-grid dashboard shell with an About tile that shows the app version.
- Auto-update over GitHub Releases through electron-updater, notify-only
  on macOS while the app is unsigned.
- The release flow: per-version installers for macOS, Windows and Linux,
  provenance attestation, and a draft GitHub release that a maintainer
  tests and publishes.
- The architecture gates: zoned boundaries, a tile template check, fallow
  dead-code and health gates, and 100% coverage thresholds.

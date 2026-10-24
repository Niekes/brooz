# Changelog

All notable changes to this project are documented in this file.

From 0.2.1 on, release-please writes the entries from the Conventional
Commits on `master`; the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

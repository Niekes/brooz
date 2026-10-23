# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

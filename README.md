<p align="center">
  <a href="https://github.com/sponsors/niekes"><img src="https://img.shields.io/badge/Sponsor_brooz-EA4AAA?logo=githubsponsors&logoColor=white&style=for-the-badge" alt="Sponsor brooz"></a>
</p>

<p align="center">
  <strong>A desktop dashboard of small apps, built on Electron.</strong><br>
  Free and open source, kept alive by one maintainer and the people who sponsor the work.
</p>

<p align="center">
  <a href="https://github.com/Niekes/brooz/actions/workflows/ci.yml"><img src="https://github.com/Niekes/brooz/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/Niekes/brooz/actions"><img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Niekes/brooz/master/.github/badges/coverage.json" alt="Coverage"></a>
  <a href="https://fallow.tools/docs/explanations/health/"><img src="https://raw.githubusercontent.com/Niekes/brooz/master/.github/badges/health.svg" alt="fallow health"></a>
  <a href="https://github.com/Niekes/brooz/releases"><img src="https://img.shields.io/github/downloads/Niekes/brooz/total" alt="GitHub downloads"></a>
  <a href="https://github.com/Niekes/brooz/releases/latest"><img src="https://img.shields.io/github/v/release/Niekes/brooz" alt="Latest version"></a>
  <a href="https://github.com/Niekes/brooz/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-BSD--3--Clause-blue" alt="License"></a>
</p>

---

brooz is a grid of tiles and every tile is a small app of its own. The first
tile, About, shows the app version; the roadmap runs towards tiles that run
local models (Transformers.js, OpenCV.js) in the browser - offline, on your
machine, no cloud.

## Download

Get the installer for your platform from the
[releases page](https://github.com/Niekes/brooz/releases/latest):

| Platform | File                                                      |
| -------- | --------------------------------------------------------- |
| macOS    | `brooz-<version>-arm64.dmg`, Intel: `brooz-<version>.dmg` |
| Windows  | `brooz-Setup-<version>.exe`                               |
| Linux    | `brooz-<version>.AppImage`                                |

**The macOS app is unsigned for now.** Gatekeeper blocks it on first launch.
Open it anyway: right-click the app and choose Open, or clear the quarantine
attribute before the first start:

```bash
xattr -dr com.apple.quarantine /Applications/brooz.app
```

The releases carry
[build provenance attestations](https://docs.github.com/en/actions/security-for-github/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds):

```bash
gh attestation verify <downloaded-asset> -R Niekes/brooz
```

## Development

Node 22 or newer is required.

```bash
git clone https://github.com/Niekes/brooz.git
cd brooz
npm install
npm run dev       # the window opens against the Vite dev server, HMR for the renderer
```

A change in the renderer reaches the window through HMR; a change in the
main process or the preload needs a restart of `npm run dev`.

The checks that have to pass:

```bash
npm run lint      # format, oxlint, the tile template, fallow
npm test          # the unit suite
npm run build     # typecheck + renderer build + electron bundles
npm run test:e2e  # against `electron .`, after npm run build
```

The architecture, the tile template and the release flow are documented in
[AGENTS.md](./AGENTS.md) and [CONTRIBUTING.md](./CONTRIBUTING.md).

## Support

brooz is free and always will be. If it is useful to you and you want to
help keep it maintained, [become a sponsor](https://github.com/sponsors/niekes).

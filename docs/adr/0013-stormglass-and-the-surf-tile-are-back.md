# Stormglass and the surf tile are back

Status: supersedes ADR-0012, reactivates ADR-0007.

The dashboard keeps the surf tile after all: the provider manifest is
OpenWeatherMap, Finnhub and Stormglass again, with the `brooz:surf` channel,
the main-process client with its on-disk budget (ADR 0007) and the surf spot
setting (key `brooz.surf.spot`, shown in the surf tile's settings section,
ADR 0014).

## Considered options

- Keep the dashboard without surf (ADR 0012): rejected - the surf forecast is
  one of the tiles the dashboard exists for, and the Stormglass client was
  already written, budgeted and tested.

## Consequences

- The surf tile follows the current tile contract: `liveData` loads the
  forecast over the chosen provider's channel (`brooz:surf`), the shell owns
  the chrome (ADR 0010), and the tile renders only its card.
- ADR 0012 stays in the history as the record of the removal; this ADR
  reverses it.

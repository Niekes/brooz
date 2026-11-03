---
status: superseded by ADR-0012
---

# Stormglass requests are budgeted and cached on disk

The surf tile's provider, Stormglass, allows ten requests a day per key on
its free plan. Every other provider is cached in memory for minutes; with
that, each app restart and each key test would spend a request, and the
quota would run out before noon.

So the main process spends it on purpose (`src/main/stormglass.ts`):

- the swell of the surf spot at most once per four hours (up to six a day,
  only while the app runs), the tides once per UTC day;
- the answers are kept in `stormglass-cache.json` under `userData`, with the
  time they were fetched, so a restart spends nothing. An entry knows its
  key by a short hash only, never the key itself (0002);
- once the quota is spent - a 402, or `meta.requestCount` reaching
  `meta.dailyQuota` - the last forecast of the spot is served with its
  fetch time and no call is made until the next UTC day. A quota belongs to
  a key, so a new key is not blocked;
- the settings' key test fetches the day's tides of the last spot and keeps
  them, so it spends no request of its own.

## Considered options

- The in-memory cache of the other providers: rejected - restarts and
  tests would spend the quota.
- Swell only, one request per refresh: rejected - the person wants the
  tides, and tides change slowly enough for one request a day.
- A fixed probe place for the key test: rejected - it spends a request
  that gives the tile nothing.

# ahooks replaces usehooks, and two hooks are our own

The renderer takes its browser hooks from `ahooks` instead of
`@uidotdev/usehooks`. usehooks covered everything we used, but its
`useInterval`, `useTimeout`, `useEventListener` and `useKeyPress` need React
experimental, so the timers and key shortcuts were written by hand in every
tile and shell module that needed them. ahooks ships them stable, and those
hand-written effects go. ahooks has no `useGeolocation` and no `useMediaQuery`;
both are written once in `shell/kit`, over `useSyncExternalStore`, rather than
keeping a second hook library for two hooks.

## Considered options

- Keep usehooks: rejected - no new code, but the timer and key effects stay
  hand-written and keep growing with every tile.
- ahooks beside usehooks for `useGeolocation` and `useMediaQuery`: rejected -
  "which library is this hook from" becomes a rule to remember, and the lint
  messages point at two packages.
- ahooks' `useRequest` for the provider hooks: rejected - our `useAsync` is
  shaped around the IPC outcome union and calls that cannot be aborted;
  `useRequest` would bring caching, polling and retries nobody uses.

## Consequences

- "ahooks first" covers hooks over a browser API or a timer (storage,
  location, media queries, timers, events, keys, debounce). App data loading
  (`useAsync`) stays ours.
- ahooks' `useLocalStorageState` keeps each call's state apart unless it is
  given `listenStorageChange`. Every stored value goes through `useStoredValue`
  in `shell/kit`, which always sets it, so a change in the settings reaches
  every open tile; the lint points at that hook, not at ahooks directly.
- ahooks' `useTimeout` restarts only when its delay changes, so a timeout
  that restarts on a new value (the ask bar's notice and auto-summon, the
  grid's highlight) stays a `useEffect`.
- Both libraries store JSON, so values already saved load unchanged; the
  sticky note's raw-text migration stays, since ahooks cannot parse it either.
- ahooks brings lodash, dayjs, js-cookie and screenfull as dependencies,
  where usehooks brought none.

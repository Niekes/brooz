## What changed

<!-- What does this pull request do, and why? -->

## Checklist

- [ ] `npm run lint` passes (format, oxlint, the tile template, fallow)
- [ ] `npm test` passes, new code is covered
- [ ] A new tile is registered in `src/renderer/tiles/index.ts` and tested
- [ ] A new IPC channel is in the contract (`src/shared/ipc.ts`) and its
      handler is tested
- [ ] The e2e suite still passes: `npm run build && npm run test:e2e`

# Contributing to Bitflix

## Reporting issues

Report bugs via the [Bitmovin Customer Dashboard](https://dashboard.bitmovin.com/support/tickets), with steps to
reproduce, the MCP host you used (Claude / ChatGPT / the local playground), and any console/network logs.

## Pull requests

- PRs should be small and focused with a clear description.
- Never commit secrets. `.env` is git-ignored, so keep license keys, tokens, and deploy credentials out of commits.

## Checks

Run the same checks CI runs before opening a PR: `npm run format:check`, `npm run lint`, `npm run typecheck` and
`npm test`. `npm test` runs Discover's unit tests (every `test/unit/*.test.ts`), then builds and boots the server for
the MCP integration test.

CI also checks that the generated view registry in `.skybridge/` is committed. If you add or rename a view, run
`npm run build` and commit the changed `.skybridge/` files with it.

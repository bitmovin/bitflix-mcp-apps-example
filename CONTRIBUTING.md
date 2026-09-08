# Contributing to Bitflix

Thanks for your interest! Bitflix is a reference implementation for video in MCP
Apps — a "streaming service inside the chat" built on
[Skybridge](https://github.com/alpic-ai/skybridge) with the
[Bitmovin Player](https://bitmovin.com/video-player/).

## Getting started

```bash
npm install
cp .env.example .env     # add your own Bitmovin Player license key
npm run dev              # DevTools playground at http://localhost:3000
```

You need your **own** Bitmovin Player license key (see the README). No key ships
with this repository.

## Ground rules

- **Never commit secrets.** `.env` is git-ignored — keep license keys, tokens,
  and deploy credentials out of commits. Only `.env.example` (placeholders) is tracked.
- Keep the catalog content fictional and the streams public test assets.
- Run `npm run build` before opening a PR; keep the TypeScript clean.
- Small, focused PRs with a clear description are easiest to review.

## Reporting issues

Open a GitHub issue with steps to reproduce, the MCP host you used (Claude /
ChatGPT / the local playground), and any console/network errors.

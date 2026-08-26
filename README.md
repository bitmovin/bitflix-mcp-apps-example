# Bitflix — a streaming service that lives inside the chat

**Bitflix is a fictional streaming network (sports · news · films · originals) shipped as an
[MCP App](https://modelcontextprotocol.io). You open it, browse it, get recommendations, and
watch — by talking to ChatGPT or Claude.** Playback is the
[Bitmovin Player](https://bitmovin.com/video-player/), embedded directly in the chat widget.

It's a demo/reference implementation, and a working answer to: *what does an online video
platform need to be when the "app" is a conversation and the UI is generated on the fly?*

Built on the [**Skybridge**](https://github.com/alpic-ai/skybridge) React framework for MCP Apps,
so it runs in the local playground, behind a dev tunnel, or deployed to a permanent URL.

> ⚠️ **Bring your own Bitmovin Player key.** This repo ships **no** license key. The
> `bitmovin-player` dependency is a proprietary, commercially-licensed SDK — see
> [Licensing](#licensing) below.

## What's in the box

```
src/
├── catalog.ts          # content: titles, public test streams, sections, search/recommend
├── server.ts           # McpServer + 4 tools (registerTool), per-view CSP, license-key injection
├── env.ts              # typed env (BITMOVIN_PLAYER_KEY)
├── helpers.ts          # generateHelpers<AppType>() → typed useToolInfo / useCallTool
├── index.css           # the cinematic broadcast OTT design system
└── views/
    ├── browse.tsx · recommend.tsx · live.tsx · player.tsx   # one entry per tool
    └── components/
        ├── BitflixApp.tsx      # shared widget: browse + player + cast + chips
        ├── BitmovinPlayer.tsx  # Bitmovin Player in a React component
        └── cover.ts            # generative per-genre SVG cover art
```

### Tools (each bound to a view via `registerTool({ view: { component } })`)

| Tool | View | Example utterance |
| --- | --- | --- |
| `browse_catalog` | `browse` | "open Bitflix", "show me sports" |
| `get_recommendations` | `recommend` | "what should I watch tonight?" |
| `whats_live` | `live` | "any games on?", "put the news on" |
| `play_title` | `player` | "play the finals", "resume Aurora" |

All four render the shared `BitflixApp`, which switches between the browse face and the player face
on `payload.view`. Tiles are clickable (instant local play, no round-trip); the category chips call
back to the server with `useCallTool`; `data-llm` keeps the model in sync with what's on screen.

### Content / streams

All streams are **public test assets**, so the demo works out of the box:

- **VOD** plays clear HLS + DASH "Art of Motion" test content on `cdn.bitmovin.com`.
- **Live** plays [**DASH-IF livesim2**](https://livesim2.dashif.org) — a genuinely-live DASH
  stream that's fully public (CORS `*`, self-hosted segments), so it plays inside the sandboxed
  view. (Many live test streams serve segments from a Referer-locked origin that `403`s inside an
  MCP host sandbox; livesim2 has no such restriction.)
- Cover art is **generated as per-genre SVG** (court, pitch, globe, film, summit, orbit…) — no
  external image fetches for the iframe CSP to block.
- The view CSP (`src/server.ts`) allow-lists `*.bitmovin.com`, `*.dashif.org`, and the Google
  Fonts origins. Per-title `sourceConfig` is forwarded to the player for DRM/subtitles/poster.

## Run it

Requires Node 22+ (Skybridge suggests 24+).

```bash
npm install
cp .env.example .env        # add your own BITMOVIN_PLAYER_KEY
npm run dev                 # DevTools playground at http://localhost:3000 — run tools, see views
```

- `npm run dev` — local DevTools at `:3000` (run each tool, switch theme/locale/display mode, audit CSP).
- `npm run dev:tunnel` — same, exposed over a stable tunnel you can add to Claude/ChatGPT.
- `npm run build` / `npm start` — production build / serve.
- `npm run deploy` — deploy to [Alpic](https://alpic.ai/) for a permanent HTTPS URL.

> **Player domain allow-listing:** a Bitmovin Player license is locked to specific domains. Make
> sure your key allow-lists whatever host serves the widget — the MCP host's sandbox domain
> (e.g. `*.claudemcpcontent.com`, `*.oaiusercontent.com`), your tunnel domain, or your deploy host.

### Connect to Claude / ChatGPT

Run `npm run dev:tunnel` (or deploy), then add the resulting HTTPS `/mcp` URL as a custom
connector. Then: *"open Bitflix"*, *"what's live?"*, *"recommend something short"*, *"play the
finals"*, *"cast it to the living room TV."*

## Making it real (what a production OVP would change)

1. Back `catalog.ts` with a real CMS/MAM + entitlements.
2. Replace `recommendationsPayload` with a real personalization service.
3. Real DRM (Widevine/FairPlay/PlayReady) + per-session tokens via the player `sourceConfig`.
4. Real casting (Google Cast / AirPlay) in place of the simulated handoff.
5. Bitmovin Analytics in the player config for QoE/engagement.

## Licensing

The source code in this repository is released under the [MIT License](./LICENSE).

**The Bitmovin Player SDK is not.** The `bitmovin-player` npm dependency is proprietary and
commercially licensed by Bitmovin. To run this app you must obtain your **own** Bitmovin Player
license key (https://bitmovin.com/dashboard) and comply with the
[Bitmovin Player license terms](https://bitmovin.com/player-license/). No key is included here.

Streams referenced in the catalog are third-party public test assets, used for demonstration only.

---

*Bitflix, its teams, scores, and titles are fictional.*

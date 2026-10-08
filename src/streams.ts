// ─────────────────────────────────────────────────────────────────────────
// Bitflix — streams
// ─────────────────────────────────────────────────────────────────────────
// Every entry is a real, publicly playable HLS/DASH source. Its origins must
// appear in VIEW_CSP (src/server.ts), which decides what the widget sandbox
// lets the player fetch.
// ─────────────────────────────────────────────────────────────────────────

import type { SourceConfig } from 'bitmovin-player';

// ── DRM (protected) test streams ────────────────────────────────────────────
// The Bitmovin "Art of Motion" DRM asset is multi-DRM (Widevine + PlayReady in
// the same DASH manifest). We attach ONE key system per stream, so each stream
// independently probes whether that CDM is available in the MCP host's
// sandbox. Which one plays tells you exactly which DRM the host exposes:
//   Widevine  → Chromium hosts (Chrome, Claude desktop, ChatGPT web)
//   PlayReady → Edge / Windows only
//   FairPlay  → Safari only (covered by the diagnostics EME probe — there's no
//               public LA/cert to attach for this asset, so we don't fake one)
const DRM_DASH = 'https://cdn.bitmovin.com/content/assets/art-of-motion_drm/mpds/11331.mpd';

/**
 * Every playable source, as the player loads it, keyed by stream id.
 *
 * Entries never cross the wire, so they may carry anything the player
 * accepts, functions included.
 */
export const STREAMS = {
  // The clear HLS and DASH renditions of Bitmovin's "Art of Motion" test asset,
  // as recommended by the Bitmovin MCP connector's `streams://recommended`
  // resource. Titles alternate between the two so both pipelines get exercised.
  // Restricting the catalog to these keeps playback working in every MCP host
  // sandbox, with no third-party-CDN CORS surprises.
  'art-of-motion-hls': {
    hls: 'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
  },
  'art-of-motion-dash': {
    dash: 'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd',
  },
  // Genuinely-LIVE stream for the "live" titles — a real live edge, not VOD
  // dressed up as live. We use DASH-IF's livesim2, which is fully public: CORS *
  // and self-hosted segments, so it plays from inside any MCP host sandbox.
  // (Many live test streams serve their segments from a Referer-locked origin,
  // which 403s from a sandboxed widget; livesim2 has no such restriction.)
  'livesim2-dash': {
    dash: 'https://livesim2.dashif.org/livesim2/testpic_2s/Manifest.mpd',
  },
  'art-of-motion-drm-widevine': {
    dash: DRM_DASH,
    drm: { widevine: { LA_URL: 'https://cwip-shaka-proxy.appspot.com/no_auth' } },
  },
  'art-of-motion-drm-playready': {
    dash: DRM_DASH,
    drm: {
      playready: {
        LA_URL:
          'https://test.playready.microsoft.com/service/rightsmanager.asmx?PlayRight=1&ContentKey=EAtsIJQPd5pFiRUrV9Layw==',
      },
    },
  },
} satisfies Record<string, SourceConfig>;

/**
 * Id of an entry in {@link STREAMS}, the only part of a stream a title carries.
 */
export type StreamId = keyof typeof STREAMS;

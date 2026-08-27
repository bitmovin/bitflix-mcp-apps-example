import { useEffect, useRef, useState } from "react";
import * as playerModule from "bitmovin-player/bitmovinplayer.prod.js";
import * as playerUiModule from "bitmovin-player/bitmovinplayer-ui.js";
import "bitmovin-player/bitmovinplayer-ui.css";
import type { Title } from "../../catalog.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Bitmovin Player + UI ship as UMD bundles that register on window.bitmovin
// when script-loaded. Bundled as ESM the globals aren't set, so re-register.
const playerExports: any = (playerModule as any).default ?? playerModule;
const uiExports: any = (playerUiModule as any).default ?? playerUiModule;
const BitmovinPlayerSDK: any = playerExports.Player ?? playerExports;
const UIFactory: any = uiExports.UIFactory;
if (typeof window !== "undefined") {
  (window as any).bitmovin = (window as any).bitmovin || {};
  (window as any).bitmovin.player = (window as any).bitmovin.player || playerExports;
  (window as any).bitmovin.playerui = (window as any).bitmovin.playerui || uiExports;
}

/**
 * Mounts the Bitmovin Player into a ref'd node that React leaves alone (the
 * player appends its own DOM). The loading / error overlays are siblings React
 * controls. Streams are fetched directly — the view CSP allow-lists every
 * origin in our catalog (Bitmovin CDN, the live-sim, S3) and they send CORS, so
 * no MCP segment proxy is needed.
 */
export type PlayerStatus =
  | { state: "loading" }
  | { state: "ready" }
  | { state: "error"; detail: string };

export type CastState = { available: boolean; casting: boolean; device?: string };

export function BitmovinPlayer({
  title,
  licenseKey,
  onStatus,
  onPlayerReady,
  onCast,
}: {
  title: Title;
  licenseKey: string;
  onStatus?: (s: PlayerStatus) => void;
  onPlayerReady?: (player: any) => void;
  onCast?: (s: CastState) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let player: any = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    onStatus?.({ state: "loading" });

    if (!BitmovinPlayerSDK) {
      setError("Bitmovin Player SDK not loaded");
      return;
    }
    const node = mountRef.current;
    if (!node) return;
    // Clear leftover player DOM. React 19 StrictMode double-invokes effects in
    // dev and Bitmovin's destroy() can leave its <video> behind, leaving an
    // empty black element on top of the live one.
    node.replaceChildren();

    player = new BitmovinPlayerSDK(node, {
      key: licenseKey,
      // Autoplay is triggered manually after load() (see below) so the play()
      // promise is caught — config autoplay leaves an uncaught rejection when
      // the browser blocks it.
      playback: { autoplay: false, muted: true },
      ui: false,
      // Real Google Cast via the player's remote-control module (loads the Cast
      // sender SDK from gstatic). In an MCP host sandbox this typically finds no
      // receiver / can't initialize — that unavailability is the actual signal.
      remotecontrol: { type: "googlecast", receiverApplicationId: "CC1AD845" },
    });
    if (UIFactory) UIFactory.buildUI(player);

    const reportCast = (device?: string) => {
      if (cancelled) return;
      try { onCast?.({ available: !!player?.isCastAvailable?.(), casting: !!player?.isCasting?.(), device }); } catch { /* ignore */ }
    };
    player.on("ready", () => {
      if (cancelled) return;
      setLoading(false);
      onStatus?.({ state: "ready" });
      onPlayerReady?.(player);
      reportCast();
    });
    player.on("error", (e: any) => {
      const detail = `Error ${e?.code ?? "?"}: ${e?.message ?? "playback failed"}`;
      if (!cancelled) { setError(detail); onStatus?.({ state: "error", detail }); }
    });
    // Real cast lifecycle from the player's Cast module.
    for (const ev of ["castavailable", "caststart", "caststarted", "caststopped", "castwaitingfordevice"]) {
      player.on(ev, (e: any) => reportCast(e?.deviceName));
    }

    const source: any = { title: title.title };
    if (title.stream.type === "hls") source.hls = title.stream.url;
    else source.dash = title.stream.url;
    if (title.sourceConfig) Object.assign(source, title.sourceConfig);

    const timeout = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("player.load() timeout after 30s")), 30000),
    );
    Promise.race([player.load(source), timeout])
      .then(() => {
        // Start muted playback ourselves so the play() promise is ours to catch.
        // Bitmovin's play() may return void, so wrap it — this catches the
        // rejection where the browser hands one back. (In a sandbox that blocks
        // even muted autoplay, e.g. the local dev playground, the underlying
        // media element can still reject internally; that's benign and does not
        // occur in a host that permits muted autoplay.)
        if (cancelled) return;
        try { Promise.resolve(player.play?.()).catch(() => {}); } catch { /* ignore */ }
      })
      .catch((e: any) => {
        const detail = e instanceof Error ? e.message : String(e);
        if (!cancelled) { setError(detail); onStatus?.({ state: "error", detail }); }
      });

    return () => {
      cancelled = true;
      try { player?.destroy(); } catch { /* ignore */ }
      try { node.replaceChildren(); } catch { /* ignore */ }
    };
  }, [title.id, title.stream.url, licenseKey]);

  return (
    <div className="player-stage">
      <div className="player-mount" ref={mountRef} />
      {(loading || error) && (
        <div className="player-loading">
          {error ? (
            <div>{error}</div>
          ) : (
            <>
              <div className="spinner" />
              <div>Tuning in to {title.title}…</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { Player, PlayerEvent, type PlayerAPI, type SourceConfig } from 'bitmovin-player';
import { UIFactory } from 'bitmovin-player-ui';
import 'bitmovin-player-ui/dist/css/bitmovinplayer-ui.css';
import { useEffect, useRef, useState } from 'react';
import type { Title } from '../../catalog.js';

export type PlayerStatus = { state: 'loading' } | { state: 'ready' } | { state: 'error'; detail: string };

export type CastState = { available: boolean; casting: boolean; device?: string };

/** How long a source may take to load before the stage reports a failure. */
const LOAD_TIMEOUT_MS = 30_000;

export interface BitmovinPlayerProps {
  title: Title;
  licenseKey: string;
  onStatus?: (s: PlayerStatus) => void;
  onPlayerReady?: (player: PlayerAPI) => void;
  onCast?: (s: CastState) => void;
}

/**
 * Mounts the Bitmovin Player into a ref'd node that React leaves alone, since
 * the player appends its own DOM. The loading and error overlays are siblings
 * React controls.
 *
 * Streams are fetched directly. Every origin the catalog uses is allow-listed
 * by the view CSP and answers with CORS, so no segment proxy is needed.
 */
export function BitmovinPlayer({ title, licenseKey, onStatus, onPlayerReady, onCast }: BitmovinPlayerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    onStatus?.({ state: 'loading' });

    const node = mountRef.current;
    if (!node) return;
    // Clear leftover player DOM. React 19 StrictMode double-invokes effects in
    // dev and Bitmovin's destroy() can leave its <video> behind, leaving an
    // empty black element on top of the live one.
    node.replaceChildren();

    const player: PlayerAPI = new Player(node, {
      key: licenseKey,
      // Autoplay is triggered manually after load() (see below) so the play()
      // promise is caught — config autoplay leaves an uncaught rejection when
      // the browser blocks it.
      playback: { autoplay: false, muted: true },
      ui: false,
      // Real Google Cast via the player's remote-control module (loads the Cast
      // sender SDK from gstatic). In an MCP host sandbox this typically finds no
      // receiver / can't initialize — that unavailability is the actual signal.
      remotecontrol: {
        type: 'googlecast',
        receiverApplicationId: 'FFE417E5',
        receiverVersion: 'v3',
      },
    });
    UIFactory.buildUI(player);

    const reportCast = (device?: string) => {
      if (cancelled) return;
      try {
        onCast?.({ available: player.isCastAvailable(), casting: player.isCasting(), device });
      } catch {
        /* ignore */
      }
    };
    player.on(PlayerEvent.Ready, () => {
      if (cancelled) return;
      setLoading(false);
      onStatus?.({ state: 'ready' });
      onPlayerReady?.(player);
      reportCast();
    });
    player.on(PlayerEvent.Error, e => {
      const detail = `Error ${e.code}: ${e.message ?? 'playback failed'}`;
      if (!cancelled) {
        setError(detail);
        onStatus?.({ state: 'error', detail });
      }
    });
    // Real cast lifecycle from the player's Cast module.
    player.on(PlayerEvent.CastAvailable, () => reportCast());
    player.on(PlayerEvent.CastStart, () => reportCast());
    player.on(PlayerEvent.CastStarted, e => reportCast(e.deviceName));
    player.on(PlayerEvent.CastStopped, () => reportCast());
    player.on(PlayerEvent.CastWaitingForDevice, e => reportCast(e.castPayload.deviceName));

    const source: SourceConfig = { title: title.title };
    if (title.stream.type === 'hls') source.hls = title.stream.url;
    else source.dash = title.stream.url;
    if (title.sourceConfig) Object.assign(source, title.sourceConfig);

    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, rej) => {
      loadTimer = setTimeout(
        () => rej(new Error(`player.load() timeout after ${LOAD_TIMEOUT_MS / 1000}s`)),
        LOAD_TIMEOUT_MS,
      );
    });
    Promise.race([player.load(source), timeout])
      .then(() => {
        // Start muted playback ourselves so the play() promise is ours to catch.
        // In a sandbox that blocks even muted autoplay (e.g. the local dev
        // playground) the rejection is benign; the user can press play.
        if (cancelled) return;
        player.play().catch(() => {
          /* ignore */
        });
      })
      .catch((e: unknown) => {
        const detail = e instanceof Error ? e.message : String(e);
        if (!cancelled) {
          setError(detail);
          onStatus?.({ state: 'error', detail });
        }
      })
      .finally(() => clearTimeout(loadTimer));

    return () => {
      cancelled = true;
      clearTimeout(loadTimer);
      try {
        player.destroy().catch(() => {});
      } catch {
        /* ignore */
      }
      try {
        node.replaceChildren();
      } catch {
        /* ignore */
      }
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

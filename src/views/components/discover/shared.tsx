import qrcode from 'qrcode-generator';
import { type ReactNode, useMemo, useState } from 'react';
import { useOpenExternal } from 'skybridge/web';
import { type Brand, type Film, hasPreview } from '../../../discover/model.js';
import { ICON } from '../cover.js';
import { Icon } from '../Icon.js';

/** The app's top bar: wordmark, a section label, and an optional right-hand slot. */
export function Topbar({ brand, label, right }: { brand: Brand; label: string; right?: ReactNode }) {
  return (
    <div className="topbar">
      <div className="wordmark">
        {brand.wordmark}
        <span className="dot">.</span>
      </div>
      <div className="discover-tag">{label}</div>
      <div className="spacer" />
      {right}
    </div>
  );
}

/**
 * Hands the user off to the film's real home. Uses the host's link-opening
 * bridge (MCP Apps `ui/open-link`, or ChatGPT's openExternal), since plain
 * anchors are unreliable inside a sandboxed iframe. The URL is also the
 * button's tooltip, for hosts that refuse to open links.
 */
export function WatchButton({ film, provider, primary = true }: { film: Film; provider: string; primary?: boolean }) {
  const openExternal = useOpenExternal();
  return (
    <button
      className={`btn ${primary ? 'btn-play' : 'btn-ghost'}`}
      onClick={e => {
        e.stopPropagation();
        // The server only sends https links on its declared watch origins;
        // refuse anything else rather than hand it to the host.
        if (film.watchUrl.startsWith('https://')) {
          openExternal(film.watchUrl);
        }
      }}
      title={film.watchUrl}
    >
      <Icon html={ICON.external} />
      Watch on {provider}
    </button>
  );
}

export function FilmMeta({ film, showPreviewBadge = true }: { film: Film; showPreviewBadge?: boolean }) {
  return (
    <div className="metarow">
      <span className="badge">{film.genre}</span>
      <span className="small">{film.year}</span>
      {film.runtimeSec ? (
        <>
          <span className="dotsep">·</span>
          <span className="small">{Math.round(film.runtimeSec / 60)} min</span>
        </>
      ) : null}
      {showPreviewBadge && hasPreview(film) ? <span className="badge preview-badge">Preview here</span> : null}
    </div>
  );
}

export function Credits({ text }: { text: string }) {
  return (
    <div className="footer-note">
      {text} Previews streamed by the <b>Bitmovin Player</b>.
    </div>
  );
}

/** The stage shown while a preview (or the player SDK itself) is loading. */
export function PlayerLoading({ title }: { title: string }) {
  return (
    <div className="player-loading">
      <div className="spinner" />
      <div>Loading the {title} preview…</div>
    </div>
  );
}

/**
 * Shown when a preview cannot play here (network, CORS, codec, license, or the
 * player chunk itself). The hand-off to the full film still works, so it stays
 * front and centre; the raw player error stays available, small, for whoever
 * is debugging.
 */
export function PreviewErrorCard({ title, handoff, detail }: { title: string; handoff?: ReactNode; detail?: string }) {
  return (
    <div className="preview-end preview-error" role="alert">
      <div className="preview-end-kicker">Preview unavailable here</div>
      <div className="preview-end-title">{title}</div>
      <div className="preview-end-actions">{handoff}</div>
      {detail ? <div className="preview-error-detail">{detail}</div> : null}
    </div>
  );
}

/**
 * What the model should know about the current screen. Skybridge's data-llm
 * attribute takes the text as its value (children are ignored), so the node
 * itself stays empty and hidden.
 */
export function ModelContext({ text }: { text: string }) {
  return <span data-llm={text} hidden />;
}

/**
 * A QR code for `url`, drawn as SVG from the code's modules (no markup string
 * from the library is injected). Scanning it opens the link on a phone or TV.
 */
function QrCode({ url, label }: { url: string; label: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(row, col)) {
          d += `M${col + 2} ${row + 2}h1v1h-1z`;
        }
      }
    }
    return { size: n + 4, path: d }; // a two-module quiet zone on each side
  }, [url]);
  return (
    <svg className="qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}

/**
 * The hand-off to a TV. Casting is blocked inside AI-assistant sandboxes, so
 * the film's link goes out as a QR code: scan it with a phone or a TV app's
 * camera, or open the link on the TV. Uses the film's TV-app deep link when
 * the catalogue has one, otherwise its watch page.
 */
export function TvHandoff({ film, provider }: { film: Film; provider: string }) {
  const [open, setOpen] = useState(false);
  const url = film.tvUrl ?? film.watchUrl;
  return (
    <div className="tv-handoff">
      <button className="btn btn-ghost" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Icon html={ICON.tv} />
        Watch on TV
      </button>
      {open ? (
        <div className="tv-panel" role="region" aria-label={`Open ${film.title} on another screen`}>
          <QrCode url={url} label={`QR code for ${film.title} on ${provider}`} />
          <div className="tv-text">
            <div className="tv-title">Scan to watch on your TV or phone</div>
            <div className="tv-sub">
              Opens {film.title} on {provider}. Casting is not available inside the chat.
            </div>
            <div className="tv-url">{url.replace(/^https:\/\//, '')}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

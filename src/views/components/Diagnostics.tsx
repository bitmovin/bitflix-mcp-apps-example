import { useEffect, useRef, useState } from "react";
import { useDisplayMode } from "skybridge/web";
import type { Brand, Title } from "../../catalog.js";
import { useAutoHeight } from "../hooks.js";
import type { PlayerStatus } from "./BitmovinPlayer.js";
import { BitmovinPlayerLazy } from "./BitmovinPlayerLazy.js";
import { ICON } from "./cover.js";
import "@/index.css";

// Payload from the run_diagnostics tool.
type DiagPayload = { view: "diagnostics"; brand: Brand; drmTitles: Title[]; licenseKey: string };
type Status = "yes" | "no" | "partial" | "pending" | "unknown";
type Row = { key: string; label: string; status: Status; detail?: string };

const Ico = ({ html }: { html: string }) => <span dangerouslySetInnerHTML={{ __html: html }} />;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── probes ──────────────────────────────────────────────────────────────────
const EME_KEY_SYSTEMS: [string, string][] = [
  ["Widevine", "com.widevine.alpha"],
  ["PlayReady", "com.microsoft.playready"],
  ["FairPlay", "com.apple.fps.1_0"],
  ["ClearKey", "org.w3.clearkey"],
];

async function probeKeySystem(ks: string): Promise<{ ok: boolean; detail: string }> {
  if (!("requestMediaKeySystemAccess" in navigator)) return { ok: false, detail: "EME API unavailable" };
  const config: MediaKeySystemConfiguration[] = [{
    initDataTypes: ["cenc", "sinf", "keyids"],
    videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
    audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
    distinctiveIdentifier: "optional",
    persistentState: "optional",
    sessionTypes: ["temporary"],
  }];
  try {
    const access = await navigator.requestMediaKeySystemAccess(ks, config);
    return { ok: true, detail: access.keySystem };
  } catch (e) {
    return { ok: false, detail: (e as Error)?.name || String(e) };
  }
}

function probeWorker(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const blob = new Blob(['self.postMessage("ok")'], { type: "application/javascript" });
      const w = new Worker(URL.createObjectURL(blob));
      const to = setTimeout(() => { resolve(false); w.terminate(); }, 2000);
      w.onmessage = () => { clearTimeout(to); resolve(true); w.terminate(); };
      w.onerror = () => { clearTimeout(to); resolve(false); w.terminate(); };
    } catch { resolve(false); }
  });
}

function initialRows(): Row[] {
  return [
    { key: "mse", label: "Media Source Extensions", status: "pending" },
    { key: "mse-worker", label: "MSE in Worker", status: "pending" },
    { key: "worker", label: "Web Workers (blob)", status: "pending" },
    { key: "wasm", label: "WebAssembly", status: "pending" },
    { key: "securectx", label: "Secure context (HTTPS)", status: "pending" },
    { key: "coi", label: "crossOriginIsolated", status: "pending" },
    { key: "autoplay", label: "Autoplay policy", status: "pending" },
    { key: "fs-avail", label: "Fullscreen API available", status: "pending" },
    { key: "pip-avail", label: "Picture-in-Picture available", status: "pending" },
    { key: "remoteplayback", label: "Remote Playback API (cast)", status: "pending" },
    { key: "presentation", label: "Presentation API (Google Cast)", status: "pending" },
    ...EME_KEY_SYSTEMS.map(([label]) => ({ key: `eme-${label}`, label: `EME · ${label}`, status: "pending" as Status })),
  ];
}

function StatusPill({ s }: { s: Status }) {
  const txt = s === "yes" ? "supported" : s === "no" ? "blocked" : s === "partial" ? "partial" : s === "unknown" ? "unknown" : "…";
  return <span className={`pill ${s}`}>{txt}</span>;
}

// ── component ─────────────────────────────────────────────────────────────────
export function Diagnostics({ payload }: { payload?: DiagPayload }) {
  const brand = payload?.brand ?? { name: "Bitflix", tagline: "", wordmark: "BITFLIX" };
  const drmTitles = payload?.drmTitles ?? [];
  const licenseKey = payload?.licenseKey ?? "";

  const [displayMode, setDisplayMode] = useDisplayMode();
  const dmRef = useRef(displayMode);
  useEffect(() => { dmRef.current = displayMode; }, [displayMode]);

  const [rows, setRows] = useState<Row[]>(initialRows());
  const [fsHost, setFsHost] = useState<Row | null>(null);
  const [fsNative, setFsNative] = useState<Row | null>(null);
  const [pip, setPip] = useState<Row | null>(null);
  const [drmPlay, setDrmPlay] = useState<Title | null>(null);
  const [drmStatus, setDrmStatus] = useState<Record<string, PlayerStatus>>({});
  const rootRef = useRef<HTMLDivElement>(null);

  useAutoHeight(rootRef);

  const patch = (key: string, status: Status, detail?: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, status, detail } : r)));

  useEffect(() => {
    let alive = true;
    (async () => {
      const mse = typeof window.MediaSource !== "undefined";
      const mseH264 = mse && MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"');
      patch("mse", mseH264 ? "yes" : mse ? "partial" : "no", mse ? (mseH264 ? "H.264 fMP4 supported" : "MSE present, H.264 unsupported") : "window.MediaSource undefined");
      patch("mse-worker", mse && (MediaSource as unknown as { canConstructInDedicatedWorker?: boolean }).canConstructInDedicatedWorker ? "yes" : "no", "MediaSource.canConstructInDedicatedWorker");
      patch("wasm", typeof WebAssembly !== "undefined" ? "yes" : "no");
      patch("securectx", window.isSecureContext ? "yes" : "no");
      patch("coi", (window as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated ? "yes" : "no", "needed for SharedArrayBuffer / some codecs");
      const gap = (navigator as unknown as { getAutoplayPolicy?: (t: string) => string }).getAutoplayPolicy;
      if (gap) { const p = gap.call(navigator, "mediaelement"); patch("autoplay", p === "allowed" ? "yes" : "partial", `getAutoplayPolicy → ${p}`); }
      else patch("autoplay", "unknown", "getAutoplayPolicy() unavailable (muted autoplay generally allowed)");
      patch("fs-avail", document.fullscreenEnabled ? "yes" : "no", document.fullscreenEnabled ? "document.fullscreenEnabled = true" : "document.fullscreenEnabled = false — the sandbox iframe has no allow=\"fullscreen\"");
      patch("pip-avail", (document as unknown as { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled ? "yes" : "no", "document.pictureInPictureEnabled");
      // Real casting primitives (what Google Cast / device handoff actually need).
      const hasRemote = "remote" in document.createElement("video");
      patch("remoteplayback", hasRemote ? "partial" : "no", hasRemote ? "HTMLMediaElement.remote present — but still needs allow=\"presentation\" + a device on the network" : "video.remote unavailable — no remote-playback/handoff primitive");
      const hasPresentation = typeof (window as unknown as { PresentationRequest?: unknown }).PresentationRequest !== "undefined";
      patch("presentation", hasPresentation ? "partial" : "no", hasPresentation ? "PresentationRequest present — but iframe needs allow=\"presentation\" for Google Cast to discover receivers" : "Presentation API unavailable — the Cast SDK can't initialize in this sandbox");

      const worker = await probeWorker();
      if (!alive) return;
      patch("worker", worker ? "yes" : "no", worker ? "blob worker executed" : "blob worker blocked or timed out");

      for (const [label, ks] of EME_KEY_SYSTEMS) {
        const r = await probeKeySystem(ks);
        if (!alive) return;
        patch(`eme-${label}`, r.ok ? "yes" : "no", r.detail);
      }
    })();
    return () => { alive = false; };
  }, []);

  const testHostFs = async () => {
    setFsHost({ key: "fs-host", label: "host displayMode", status: "pending" });
    try {
      setDisplayMode("fullscreen");
      await sleep(700);
      const after = dmRef.current;
      const ok = after === "fullscreen";
      setFsHost({ key: "fs-host", label: "host displayMode", status: ok ? "partial" : "no", detail: ok ? "widget maximized to fill the client window — NOT true OS/desktop fullscreen (video still sits inside the host chrome)" : `host did not switch — displayMode stayed "${after}"` });
    } catch (e) {
      setFsHost({ key: "fs-host", label: "host displayMode", status: "no", detail: (e as Error)?.message || String(e) });
    }
  };

  const testNativeFs = async () => {
    const el = rootRef.current;
    if (!document.fullscreenEnabled) {
      setFsNative({ key: "fs-native", label: "native Fullscreen API", status: "no", detail: 'true OS/desktop fullscreen — BLOCKED: document.fullscreenEnabled = false because the widget iframe has no allow="fullscreen" (Permissions Policy), so element.requestFullscreen() is unavailable' });
      return;
    }
    if (!el) return;
    try {
      await el.requestFullscreen();
      await sleep(350);
      // requestFullscreen() resolving is NOT proof of real fullscreen — the host
      // can confine it to the widget's iframe area. Verify by measuring whether
      // the viewport actually grew to the physical screen.
      const fsEl = !!document.fullscreenElement;
      const w = window.innerWidth, h = window.innerHeight;
      const sw = window.screen.width, sh = window.screen.height;
      const fills = fsEl && Math.abs(w - sw) <= 6 && Math.abs(h - sh) <= 6;
      if (fills) {
        setFsNative({ key: "fs-native", label: "native Fullscreen API", status: "yes", detail: `entered true OS fullscreen — viewport ${w}×${h} matches screen ${sw}×${sh}` });
      } else if (fsEl) {
        setFsNative({ key: "fs-native", label: "native Fullscreen API", status: "partial", detail: `requestFullscreen() resolved but did NOT fill the screen — viewport only reached ${w}×${h} vs screen ${sw}×${sh}; the host confines "fullscreen" to the widget's iframe area, so there's no real desktop fullscreen` });
      } else {
        setFsNative({ key: "fs-native", label: "native Fullscreen API", status: "no", detail: "resolved but no fullscreenElement" });
      }
      await sleep(1200);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch (e) {
      setFsNative({ key: "fs-native", label: "native Fullscreen API", status: "no", detail: `true OS fullscreen — BLOCKED: ${(e as Error)?.message || (e as Error)?.name || String(e)}` });
    }
  };

  const testPip = async () => {
    const enabled = (document as unknown as { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled;
    if (!enabled) { setPip({ key: "pip", label: "Picture-in-Picture", status: "no", detail: "document.pictureInPictureEnabled = false" }); return; }
    const v = rootRef.current?.querySelector("video") as HTMLVideoElement | null;
    if (!v) { setPip({ key: "pip", label: "Picture-in-Picture", status: "unknown", detail: "no active <video> — start a DRM playback test below first, then retry" }); return; }
    try { await v.requestPictureInPicture(); setPip({ key: "pip", label: "Picture-in-Picture", status: "yes", detail: "entered PiP" }); }
    catch (e) { setPip({ key: "pip", label: "Picture-in-Picture", status: "no", detail: (e as Error)?.message || String(e) }); }
  };

  // model-readable summary
  const summarize = () => {
    const lines = rows.filter((r) => r.status !== "pending").map((r) => `${r.label}: ${r.status}${r.detail ? ` (${r.detail})` : ""}`);
    if (fsHost) lines.push(`Fullscreen (host displayMode): ${fsHost.status}${fsHost.detail ? ` (${fsHost.detail})` : ""}`);
    if (fsNative) lines.push(`Fullscreen (native API): ${fsNative.status}${fsNative.detail ? ` (${fsNative.detail})` : ""}`);
    if (pip) lines.push(`PiP test: ${pip.status}${pip.detail ? ` (${pip.detail})` : ""}`);
    for (const t of drmTitles) { const s = drmStatus[t.id]; if (s) lines.push(`DRM ${t.title}: ${s.state}${s.state === "error" ? ` (${s.detail})` : ""}`); }
    return `Bitflix video-capability diagnostics for this MCP host sandbox:\n- ${lines.join("\n- ")}`;
  };

  const extraRow = (r: Row | null) =>
    r ? <div className="diag-row"><span className="diag-label">{r.label}</span><StatusPill s={r.status} />{r.detail ? <span className="diag-detail">{r.detail}</span> : null}</div> : null;

  return (
    <div className="bitflix-root" ref={rootRef}>
      <div className="topbar">
        <div className="wordmark">{brand.wordmark}<span className="dot">.</span></div>
        <div className="spacer" />
        <span className="prompt-chip"><span className="mic" />Video capability probe</span>
      </div>
      <div className="headline reveal">
        <h1>Diagnostics</h1>
        <p>What does this MCP host's widget sandbox actually allow for video? Results below are probed live in this iframe.</p>
      </div>

      {/* Capability matrix */}
      <div className="rail reveal">
        <div className="rail-head"><h3>Sandbox capabilities</h3></div>
        <div className="diag-table">
          {rows.map((r) => (
            <div className="diag-row" key={r.key}>
              <span className="diag-label">{r.label}</span>
              <StatusPill s={r.status} />
              {r.detail ? <span className="diag-detail">{r.detail}</span> : null}
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen + PiP — the reported gaps */}
      <div className="rail reveal">
        <div className="rail-head"><h3>Fullscreen &amp; Picture-in-Picture</h3><span className="sub">two different things: host displayMode = maximize inside the client window · native API = true OS/desktop fullscreen</span></div>
        <div className="diag-btn-row">
          <button className="iconbtn accent" onClick={testHostFs}><Ico html={ICON.tv} />Fullscreen — host displayMode</button>
          <button className="iconbtn" onClick={testNativeFs}><Ico html={ICON.tv} />Fullscreen — native API</button>
          <button className="iconbtn" onClick={testPip}><Ico html={ICON.cast} />Picture-in-Picture</button>
        </div>
        <div className="diag-table">
          {extraRow(fsHost)}
          {extraRow(fsNative)}
          {extraRow(pip)}
          {!fsHost && !fsNative && !pip ? <div className="diag-detail" style={{ padding: "6px 2px" }}>Current display mode: <b>{displayMode}</b>. Click a test above.</div> : null}
        </div>
      </div>

      {/* DRM playback */}
      <div className="rail reveal">
        <div className="rail-head"><h3>DRM playback</h3><span className="sub">which CDM does the sandbox expose? Widevine = Chromium, PlayReady = Edge, FairPlay = Safari</span></div>
        <div className="diag-btn-row">
          {drmTitles.map((t) => {
            const s = drmStatus[t.id];
            const label = t.badges.find((b) => b === "WIDEVINE" || b === "PLAYREADY") || t.title;
            return (
              <button key={t.id} className={`iconbtn ${drmPlay?.id === t.id ? "accent" : ""}`} onClick={() => setDrmPlay(t)}>
                <Ico html={ICON.play} />{label}
                {s ? <span className={`pill ${s.state === "ready" ? "yes" : s.state === "error" ? "no" : "pending"}`}>{s.state === "ready" ? "plays" : s.state === "error" ? "blocked" : "…"}</span> : null}
              </button>
            );
          })}
        </div>
        {drmPlay ? (
          <div style={{ marginTop: 12 }}>
            <div className="player-shell">
              <BitmovinPlayerLazy title={drmPlay} licenseKey={licenseKey} onStatus={(s) => setDrmStatus((m) => ({ ...m, [drmPlay.id]: s }))} />
            </div>
            {drmStatus[drmPlay.id]?.state === "error" ? (
              <div className="diag-detail" style={{ marginTop: 8 }}>{drmStatus[drmPlay.id] && "detail" in drmStatus[drmPlay.id]! ? (drmStatus[drmPlay.id] as { detail: string }).detail : ""}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div data-llm="" style={{ display: "none" }}>{summarize()}</div>
    </div>
  );
}

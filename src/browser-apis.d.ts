// Browser APIs the diagnostics panel probes for that the DOM lib does not
// declare. Both are optional: whether the host exposes them is the measurement.

interface Navigator {
  /** Chromium only. Reports whether media may autoplay, muted or at all. */
  getAutoplayPolicy?(type: 'mediaelement' | 'audiocontext'): string;
}

interface Window {
  /** Presentation API, which Google Cast needs to discover receivers. */
  PresentationRequest?: unknown;
}

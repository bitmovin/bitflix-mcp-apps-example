import { Suspense, lazy } from 'react';
import type { BitmovinPlayerProps } from './BitmovinPlayer.js';

const LoadedPlayer = lazy(() => import('./BitmovinPlayer.js').then(m => ({ default: m.BitmovinPlayer })));

/**
 * The Bitmovin player, code-split behind a dynamic import so views that only
 * browse never download the player SDK. Mounting this fetches the SDK chunk
 * and shows the stage overlay until it arrives.
 */
export function BitmovinPlayerLazy(props: BitmovinPlayerProps) {
  return (
    <Suspense
      fallback={
        <div className="player-stage">
          <div className="player-loading">
            <div className="spinner" />
            <div>Tuning in to {props.title.title}…</div>
          </div>
        </div>
      }
    >
      <LoadedPlayer {...props} />
    </Suspense>
  );
}

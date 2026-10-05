import { Component, type ReactNode, Suspense, lazy } from 'react';
import type { PreviewPlayerProps } from './PreviewPlayer.js';
import { PlayerLoading, PreviewErrorCard } from './shared.js';

const LoadedPlayer = lazy(() => import('./PreviewPlayer.js').then(m => ({ default: m.PreviewPlayer })));

/**
 * Catches a failure to load the player chunk itself (a network blip in the
 * sandbox, or a chunk hash that changed with a redeploy), which would
 * otherwise blank the whole widget. Shows the same card as a failed preview.
 */
class PlayerChunkBoundary extends Component<
  { title: string; handoff?: ReactNode; onError?: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[bitflix-discover] the preview player failed to load', error);
    this.props.onError?.();
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <div className="player-stage preview-stage">
        <PreviewErrorCard title={this.props.title} handoff={this.props.handoff} />
      </div>
    );
  }
}

/**
 * The preview player, code-split behind a dynamic import so screens that only
 * browse never download the player SDK. Mounting this fetches the SDK chunk
 * and shows the loading stage until it arrives.
 */
export function PreviewPlayerLazy(props: PreviewPlayerProps) {
  return (
    <PlayerChunkBoundary title={props.film.title} handoff={props.handoff} onError={props.onError}>
      <Suspense
        fallback={
          <div className="player-stage preview-stage">
            <PlayerLoading title={props.film.title} />
          </div>
        }
      >
        <LoadedPlayer {...props} />
      </Suspense>
    </PlayerChunkBoundary>
  );
}

import '@/views/css/discover.css';
import { useEffect, useRef, useState } from 'react';
import { type ReelPayload, nextIndex } from '../../../discover/model.js';
import { useAutoHeight } from '../../hooks.js';
import { ICON, coverArt } from '../cover.js';
import { Icon } from '../Icon.js';
import { PreviewPlayerLazy } from './PreviewPlayerLazy.js';
import { Credits, FilmMeta, ModelContext, Topbar, WatchButton } from './shared.js';

const ADVANCE_DELAY_MS = 4_000; // time the end (or error) card stays up before the reel moves on
const MAX_FAILURES_IN_A_ROW = 3; // then the reel stops: the host is probably blocking every stream

/**
 * The Trailer Reel: previews played back to back, built for the side panel
 * next to a conversation (ChatGPT's thread entry point), where it keeps
 * running while the user chats. Each preview ends on a hand-off to the full
 * film; after a short beat the reel moves to the next one, and it stops after
 * the last.
 */
export function TrailerReel({ payload, licenseKey }: { payload?: ReelPayload; licenseKey: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useAutoHeight(rootRef);
  const [index, setIndex] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  // Whether the current preview is showing its end or error card, i.e. waiting to move on.
  const [waiting, setWaiting] = useState(false);
  const failures = useRef(0); // previews in a row that could not play
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const films = payload?.films ?? [];
  const film = films[index];

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const cancelAdvance = () => clearTimeout(advanceTimer.current);
  const goTo = (i: number) => {
    if (i === index) {
      return; // already playing: the card's own Replay restarts it
    }
    cancelAdvance();
    failures.current = 0; // the user is choosing, so start counting afresh
    setWaiting(false);
    setIndex(nextIndex(i, films.length, 0));
  };
  /**
   * Moves the reel on after a short beat, unless it should stop: it plays the
   * queue once, without wrapping around, and gives up after a few previews in a
   * row fail. Each preview builds a fresh player with its own license check, so
   * a panel left open must not keep doing that forever.
   */
  const scheduleAdvance = (auto: boolean) => {
    cancelAdvance();
    const last = index >= films.length - 1;
    if (auto && !last && failures.current < MAX_FAILURES_IN_A_ROW) {
      advanceTimer.current = setTimeout(() => {
        setWaiting(false);
        setIndex(i => i + 1);
      }, ADVANCE_DELAY_MS);
    }
  };
  // A finished preview and one that cannot play here both move the reel on, so a
  // single broken stream never stalls it; the card in between keeps the hand-off.
  const onEnded = () => {
    failures.current = 0;
    setWaiting(true);
    scheduleAdvance(autoAdvance);
  };
  const onError = () => {
    failures.current++;
    setWaiting(true);
    scheduleAdvance(autoAdvance);
  };
  const onReplay = () => {
    cancelAdvance();
    setWaiting(false);
  };
  const toggleAuto = (on: boolean) => {
    setAutoAdvance(on);
    if (on && waiting) {
      scheduleAdvance(true); // turned back on while a card is up: resume
    } else if (!on) {
      cancelAdvance(); // an advance may already be counting down
    }
  };

  if (!payload || !film) {
    return (
      <div ref={rootRef} className="bitflix-root reel-root">
        <div className="empty">Loading the Trailer Reel…</div>
      </div>
    );
  }

  const provider = payload.brand.watchProvider;

  return (
    <div ref={rootRef} className="bitflix-root reel-root">
      <Topbar
        brand={payload.brand}
        label="Trailer Reel"
        right={
          <span className="reel-count" aria-live="polite">
            {index + 1} / {films.length}
          </span>
        }
      />

      <div className="player-shell">
        <PreviewPlayerLazy
          key={film.id}
          film={film}
          licenseKey={licenseKey}
          onEnded={onEnded}
          onError={onError}
          onReplay={onReplay}
          handoff={<WatchButton film={film} provider={provider} />}
        />
      </div>

      <div className="film-bar reel-bar">
        <div className="titleblock">
          <h2>{film.title}</h2>
          <FilmMeta film={film} showPreviewBadge={false} />
          <p className="syn">{film.logline}</p>
        </div>
        <div className="controls">
          <WatchButton film={film} provider={provider} />
          {films.length > 1 ? (
            <button className="iconbtn" onClick={() => goTo(index + 1)}>
              <Icon html={ICON.next} />
              Next preview
            </button>
          ) : null}
        </div>
      </div>

      <label className="reel-auto">
        <input type="checkbox" checked={autoAdvance} onChange={e => toggleAuto(e.target.checked)} />
        Play the next preview automatically
      </label>

      <ol className="reel-queue" aria-label="Up next in the reel">
        {films.map((f, i) => (
          <li key={f.id}>
            <button
              className={`reel-item ${i === index ? 'is-current' : ''}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => goTo(i)}
            >
              <span
                className="reel-thumb"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: coverArt(f.cover, f.title.charAt(0)) }}
              />
              <span className="reel-text">
                <span className="t">{f.title}</span>
                <span className="k">
                  {f.year} · {f.genre}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <Credits text={payload.credits} />
      <ModelContext
        text={`The ${payload.brand.name} Trailer Reel is playing the "${film.title}" preview (${index + 1} of ${films.length}). Full film: ${film.watchUrl}.`}
      />
    </div>
  );
}

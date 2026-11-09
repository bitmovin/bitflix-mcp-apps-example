import '@/views/css/matchday.css';
import { useRef, useState } from 'react';
import { useDisplayMode } from 'skybridge/web';
import { type Fixture, MOMENT_LABELS, type MatchdayPayload, type Moment, scoreLine } from '../../matchday.js';
import { useAutoHeight } from '../hooks.js';
import { BitmovinPlayerLazy } from './BitmovinPlayerLazy.js';
import { FooterNote, LiveBadge, Topbar } from './chrome.js';
import { ICON } from './cover.js';
import { Icon } from './Icon.js';

function stateLabel(f: Fixture): string {
  switch (f.state) {
    case 'live':
      return f.clock;
    case 'ft':
      return 'Full time';
    case 'upcoming':
      return `Kick-off ${f.kickoff}`;
    default: {
      const unhandled: never = f;
      return unhandled;
    }
  }
}

function Scoreboard({ f }: { f: Fixture }) {
  return (
    <div className="md-board reveal">
      <div className="md-comp">
        {f.competition} · {f.venue}
      </div>
      <div className="md-scoreline">
        <div className="md-team home">
          <span className="md-code">{f.home.code}</span>
          <span className="md-name">{f.home.name}</span>
        </div>
        <div className="md-score">{f.state === 'upcoming' ? 'v' : `${f.score[0]} – ${f.score[1]}`}</div>
        <div className="md-team away">
          <span className="md-code">{f.away.code}</span>
          <span className="md-name">{f.away.name}</span>
        </div>
      </div>
      <div className="md-state">
        {f.state === 'live' ? <LiveBadge /> : null}
        <span className="live-clock">{stateLabel(f)}</span>
      </div>
    </div>
  );
}

function MomentRow({ f, m, active, onPick }: { f: Fixture; m: Moment; active: boolean; onPick: (m: Moment) => void }) {
  return (
    <button
      className={`md-moment kind-${m.kind} side-${m.side} ${active ? 'is-active' : ''}`}
      onClick={() => onPick(m)}
      aria-pressed={active}
    >
      <span className="md-clock">{m.clock}</span>
      <span className="md-body">
        <span className="md-kind">
          {MOMENT_LABELS[m.kind]} · {f[m.side].code}
        </span>
        <span className="md-text">{m.text}</span>
      </span>
      <span className="md-replay" aria-hidden="true">
        <Icon html={active ? ICON.play : ICON.replay} />
      </span>
    </button>
  );
}

function Stats({ f }: { f: Fixture }) {
  if (!f.stats.length) {
    return null;
  }
  return (
    <div className="md-stats">
      {f.stats.map(s => {
        const total = s.home + s.away || 1;
        return (
          <div key={s.label} className="md-stat">
            <div className="md-stat-row">
              <span>
                {s.home}
                {s.unit}
              </span>
              <span className="md-stat-label">{s.label}</span>
              <span>
                {s.away}
                {s.unit}
              </span>
            </div>
            <div className="md-bar">
              <span className="home" style={{ width: `${(s.home / total) * 100}%` }} />
              <span className="away" style={{ width: `${(s.away / total) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FixtureCard({ f, onOpen }: { f: Fixture; onOpen: (id: string) => void }) {
  return (
    <button className="md-fixture" onClick={() => onOpen(f.id)}>
      <span className="md-fx-comp">{f.competition}</span>
      <span className="md-fx-teams">
        {f.home.name} <span className="dim">v</span> {f.away.name}
      </span>
      <span className="md-fx-state">
        {f.state === 'live' ? <LiveBadge /> : null}
        {scoreLine(f) ? <span className="score">{scoreLine(f)}</span> : null}
        <span className="live-clock">{stateLabel(f)}</span>
      </span>
    </button>
  );
}

/**
 * The match centre: the broadcast or a replay on top, the scoreboard, the key
 * moments to tap through, the stats and the rest of the day's card.
 *
 * Mounted with a key per fixture and focus, so a new tool result starts from
 * the moment it asked for.
 */
export function MatchdayView({
  p,
  onOpen,
  onBack,
}: {
  p: MatchdayPayload;
  onOpen: (fixtureId: string) => void;
  onBack: () => void;
}) {
  const [displayMode, setDisplayMode] = useDisplayMode();
  const rootRef = useRef<HTMLDivElement>(null);
  const f = p.fixture;
  // A finished game has no broadcast, so it opens on its first moment.
  const [momentId, setMomentId] = useState<string | undefined>(
    p.focusMomentId ?? (p.live ? undefined : f.moments[0]?.id),
  );
  const isFs = displayMode === 'fullscreen';

  useAutoHeight(rootRef);

  const moment = f.moments.find(m => m.id === momentId);
  const playing = (moment && p.clips[moment.id]) || p.live;

  return (
    <div className="bitflix-root" ref={rootRef}>
      <div className="player-view">
        <Topbar brand={p.brand} prompt="Catch me up" />
        <Scoreboard f={f} />
        {playing ? (
          <div className="player-shell">
            <BitmovinPlayerLazy title={playing} licenseKey={p.licenseKey} />
          </div>
        ) : (
          <div className="md-prematch">
            Coverage starts at {f.state === 'upcoming' ? f.kickoff : 'kick-off'}. Catch up on today's other games below.
          </div>
        )}
        <div className="player-bar">
          <div className="titleblock">
            <div className="kicker">{moment ? 'Replay' : p.live ? 'Live broadcast' : 'Match centre'}</div>
            <h2>{moment ? `${moment.clock} ${MOMENT_LABELS[moment.kind]}` : `${f.home.name} v ${f.away.name}`}</h2>
            {moment ? <p className="syn">{moment.text}</p> : null}
          </div>
          <div className="controls">
            <button className="iconbtn" onClick={onBack}>
              <Icon html={ICON.back} />
              Bitflix
            </button>
            {moment && p.live ? (
              <button className="iconbtn accent" onClick={() => setMomentId(undefined)}>
                <Icon html={ICON.tv} />
                Back to live
              </button>
            ) : null}
            {playing ? (
              <button className="iconbtn" onClick={() => setDisplayMode(isFs ? 'inline' : 'fullscreen')}>
                <Icon html={ICON.tv} />
                {isFs ? 'Exit' : 'Fullscreen'}
              </button>
            ) : null}
          </div>
        </div>
        {f.moments.length ? (
          <div className="md-grid">
            <div className="md-moments">
              <div className="rail-head">
                <h3>Key moments</h3>
                <span className="sub">Tap to replay</span>
              </div>
              {f.moments.map(m => (
                <MomentRow key={m.id} f={f} m={m} active={m.id === momentId} onPick={x => setMomentId(x.id)} />
              ))}
            </div>
            <div>
              <div className="rail-head">
                <h3>Match stats</h3>
              </div>
              <Stats f={f} />
            </div>
          </div>
        ) : null}
        {p.fixtures.length ? (
          <div className="rail">
            <div className="rail-head">
              <h3>Around the grounds</h3>
              <span className="sub">Today's other fixtures</span>
            </div>
            <div className="md-fixtures">
              {p.fixtures.map(x => (
                <FixtureCard key={x.id} f={x} onOpen={onOpen} />
              ))}
            </div>
          </div>
        ) : null}
        <FooterNote brand={p.brand} />
      </div>
      <div data-llm="" style={{ display: 'none' }}>
        {`The Bitflix match centre shows ${f.home.name} v ${f.away.name} (${f.competition}), ${stateLabel(f)}${scoreLine(f) ? `, ${scoreLine(f)}` : ''}. ${moment ? `The user is replaying the ${moment.clock} ${MOMENT_LABELS[moment.kind].toLowerCase()}: ${moment.text}` : p.live ? 'The live broadcast is playing.' : 'Nothing is playing.'} Key moments: ${f.moments.map(m => `${m.clock} ${MOMENT_LABELS[m.kind]}`).join(', ') || 'none yet'}.`}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { Badge, Brand } from '../../catalog.js';

// Pieces of broadcast chrome shared by the Bitflix views.

export function FooterNote({ brand }: { brand: Brand }) {
  return (
    <div className="footer-note">
      <b>{brand.name}</b> — a streaming service inside the chat · video by <b>Bitmovin Player</b>
    </div>
  );
}

export function Badges({ items }: { items: Badge[] }) {
  return (
    <span className="badges">
      {items.map((b, i) => (
        <span key={i} className="badge">
          {b}
        </span>
      ))}
    </span>
  );
}

/** The live marker, which the delivery discriminant carries rather than a badge. */
export function LiveBadge() {
  return <span className="badge live">LIVE</span>;
}

export function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="onair-time">
      {p(now.getHours())}:{p(now.getMinutes())}:{p(now.getSeconds())}
    </span>
  );
}

export function Topbar({ brand, prompt }: { brand: Brand; prompt?: string }) {
  return (
    <div className="topbar">
      <div className="wordmark">
        {brand.wordmark}
        <span className="dot">.</span>
      </div>
      {brand.edition ? <div className="edition-tag">{brand.edition}</div> : null}
      <div className="onair" aria-label="On air" title={`${brand.name} is broadcasting`}>
        <span className="onair-dot" />
        ON AIR
        <LiveClock />
      </div>
      <div className="spacer" />
      {prompt ? (
        <div className="prompt-chip">
          <span className="mic" />
          {`“${prompt}”`}
        </div>
      ) : null}
    </div>
  );
}

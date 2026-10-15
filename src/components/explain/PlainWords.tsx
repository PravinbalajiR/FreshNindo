// FreshRoute — Plain-language layer.
// <PlainWords>: "In plain words" box with sentences computed from real numbers,
//   plus an "Explain more" button that asks the AI to rewrite the same facts.
// <StockFlowBar>: one 100% bar showing where the stock goes.
// <Term>: dotted-underline jargon with a hover/focus definition.

import React, { useState } from 'react';
import { apiFetch } from '../../services/api';

// ─── PlainWords ──────────────────────────────────────────────────────────────

interface PlainWordsProps {
  topic: string;
  /** What is displayed. Plain strings double as the AI's facts. */
  points: string[];
  /** Extra facts for the AI only (numbers not worth showing). */
  extraFacts?: string[];
  title?: string;
}

export const PlainWords: React.FC<PlainWordsProps> = ({ topic, points, extraFacts = [], title = 'In plain words' }) => {
  const [ai, setAi] = useState<{ text: string; source: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const explain = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/assistant/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.slice(0, 100), facts: [...points, ...extraFacts].slice(0, 25).map((f) => f.slice(0, 300)) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAi({
        text: data.reply,
        source: data.status === 'OK' ? 'Written by AI (Qwen) from the numbers above' : 'AI unavailable: showing the built-in summary',
      });
    } catch {
      setAi({ text: 'Could not reach the explanation service. The summary above is still accurate.', source: 'Offline' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="plain-words" aria-label={title}>
      <div className="plain-head">
        <span className="plain-title">💬 {title}</span>
        <button className="btn btn-ghost btn-sm" onClick={explain} disabled={loading}>
          {loading ? 'Thinking…' : ai ? '↻ Explain again' : '✨ Explain more'}
        </button>
      </div>
      <ul className="plain-list">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {ai && (
        <div className="plain-ai anim-fade">
          <div style={{ whiteSpace: 'pre-wrap' }}>{ai.text}</div>
          <div className="plain-source">{ai.source}</div>
        </div>
      )}
    </section>
  );
};

// ─── StockFlowBar ────────────────────────────────────────────────────────────

export interface FlowSegment {
  key: string;
  label: string;
  kg: number;
  /** categorical slot colour — validated set, fixed order */
  color: string;
  note?: string;
}

/** Validated categorical palette (light surface), fixed order. */
export const FLOW_COLORS = {
  sold: '#2a78d6',
  discount: '#eb6834',
  storage: '#1baf7a',
  risk: '#eda100',
} as const;

export const StockFlowBar: React.FC<{ segments: FlowSegment[]; caption?: string }> = ({ segments, caption }) => {
  const [hover, setHover] = useState<string | null>(null);
  const shown = segments.filter((s) => s.kg > 0.5);
  const total = shown.reduce((s, x) => s + x.kg, 0);
  if (total <= 0) return null;

  return (
    <figure className="flow" aria-label={caption ?? 'Where the stock goes'}>
      {caption && <figcaption className="flow-caption">{caption}</figcaption>}
      <div className="flow-bar" role="img" aria-label={shown.map((s) => `${s.label} ${Math.round((s.kg / total) * 100)}%`).join(', ')}>
        {shown.map((s) => {
          const pct = (s.kg / total) * 100;
          return (
            <div
              key={s.key}
              className={`flow-seg ${hover && hover !== s.key ? 'dim' : ''}`}
              style={{ width: `${pct}%`, background: s.color }}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === s.key && (
                <div className="flow-tip" role="tooltip">
                  <b>{s.label}</b>
                  <div>{Math.round(s.kg).toLocaleString('en-IN')} kg · {pct.toFixed(0)}%</div>
                  {s.note && <div className="flow-tip-note">{s.note}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flow-legend">
        {shown.map((s) => (
          <span key={s.key} className="flow-key" onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}>
            <span className="flow-swatch" style={{ background: s.color }} />
            <span>{s.label}</span>
            <b>{Math.round((s.kg / total) * 100)}%</b>
            <span className="flow-kg">{Math.round(s.kg).toLocaleString('en-IN')} kg</span>
          </span>
        ))}
      </div>
    </figure>
  );
};

/** "Out of every 10 kg, 7 sell at full price, 2 …" — rounded so parts sum to 10. */
export function outOfTen(segments: FlowSegment[]): string {
  const shown = segments.filter((s) => s.kg > 0.5);
  const total = shown.reduce((s, x) => s + x.kg, 0);
  if (total <= 0) return 'There is no stock to place right now.';
  if (shown.length === 1) return `All ${Math.round(total).toLocaleString('en-IN')} kg: ${shown[0].label.toLowerCase()}.`;
  const raw = shown.map((s) => (s.kg / total) * 10);
  const parts = raw.map(Math.floor);
  let rest = 10 - parts.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => {
      if (rest > 0) {
        parts[i] += 1;
        rest -= 1;
      }
    });
  const phrases = shown
    .map((s, i) => ({ n: parts[i], label: s.label.toLowerCase() }))
    .filter((p) => p.n > 0)
    .map((p) => `${p.n} ${p.label}`);
  return `Out of every 10 kg: ${joinAnd(phrases)}.`;
}

/** ["a","b","c"] → "a, b and c" */
export function joinAnd(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] ?? '';
}

// ─── Term (glossary tooltip) ─────────────────────────────────────────────────

export const GLOSSARY: Record<string, string> = {
  'Fresh Window': 'How many hours the produce will still be good AFTER it reaches the market and is unloaded. More hours = safer.',
  margin: 'Hours of freshness left on arrival: shelf life minus travel time minus unloading time.',
  fulfillment: 'How much of what markets asked for actually gets delivered. 100% means every order is filled.',
  'net revenue': 'Money left after paying for the produce and the transport. This is the profit before other costs.',
  spoilage: 'Produce that goes bad before anyone can sell it. That money is lost.',
  baseline: 'A simple rule to compare against: always send the oldest stock first, by the cheapest truck.',
  'dispatch priority': 'The order trucks should leave in. #1 leaves first because it spoils soonest or is worth most.',
  'value at risk': 'What the produce cost to buy. You lose this money if it spoils.',
  'storage life': 'How many days produce stays good inside a cold store at the right temperature.',
};

export const Term: React.FC<{ k: keyof typeof GLOSSARY | string; children?: React.ReactNode }> = ({ k, children }) => {
  const def = GLOSSARY[k as string];
  if (!def) return <>{children ?? k}</>;
  return (
    <span className="term" tabIndex={0} aria-label={`${children ?? k}: ${def}`}>
      {children ?? k}
      <span className="term-tip" role="tooltip">{def}</span>
    </span>
  );
};

// FreshRoute — Cold storage management (Farmer + Manager views).
// Farmers: find a cold store anywhere in India, store a batch, watch days-left and
// quality, release it back to market. Managers: every stored lot nationwide plus
// store-vs-ship advice for today's stock.

import React, { useMemo, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { FACILITIES, STORAGE_PROFILES } from '../../data/coldStorage';
import {
  LOT_HEALTH_META,
  lotStatus,
  releaseAsBatch,
  searchFacilities,
  storeVsShip,
  type LotStatus,
  type StorageAdvice,
} from '../../engine/coldStorage';
import { FacilityMap } from './FacilityMap';
import { PageHeader, formatINR, formatKg, useToast } from '../shared';
import { PlainWords, StockFlowBar, Term, outOfTen } from '../explain/PlainWords';
import { stockFlow } from '../explain/stockFlow';

const DAY = 86_400_000;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const HEALTH_COLOR = { GOOD: '#1f9d55', SELL_SOON: '#d98a00', EXPIRED: '#d93025' } as const;

/** "View as of" slider: fast-forward the clock to see quality and days-left change. */
const TimeTravel: React.FC<{ days: number; onChange: (d: number) => void }> = ({ days, onChange }) => (
  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
    <div style={{ minWidth: 200 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>⏩ Look ahead</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Slide to see how stored stock will look in the coming days.</div>
    </div>
    <input type="range" min={0} max={30} value={days} onChange={(e) => onChange(+e.target.value)} style={{ flex: 1, minWidth: 200, accentColor: '#0071e3' }} aria-label="Days ahead" />
    <div style={{ fontWeight: 700, minWidth: 110, textAlign: 'right' }}>{days === 0 ? 'Today' : `In ${days} day${days > 1 ? 's' : ''}`}</div>
  </div>
);

const LotRow: React.FC<{ s: LotStatus; onRelease?: () => void; showOwner?: boolean }> = ({ s, onRelease, showOwner }) => {
  const meta = LOT_HEALTH_META[s.health];
  return (
    <div className="list-row">
      <div className="list-main" style={{ minWidth: 220 }}>
        <div className="list-title">
          {s.lot.commodity} · {formatKg(s.lot.quantity_kg)}
          <span className="role-tag" style={{ marginLeft: 6 }}>
            Grade {s.lot.grade_in}{s.grade_now !== s.lot.grade_in ? ` → ${s.grade_now}` : ''}
          </span>
        </div>
        <div className="list-meta">
          {s.lot.lot_id} · ❄ {s.facility?.name}, {s.facility?.city} · in since {fmtDate(s.lot.stored_at)}
          {showOwner ? ` · ${s.lot.farmer_name}` : ''}
        </div>
      </div>
      <div style={{ flex: 1.3, minWidth: 220 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span>{Math.floor(s.days_stored)} days stored</span>
          <b style={{ color: HEALTH_COLOR[s.health] }}>{s.days_left > 0 ? `${Math.ceil(s.days_left)} days left` : 'Past storage life'}</b>
        </div>
        <div className="days-bar" title={`${Math.round(s.pct_used * 100)}% of ${s.max_days}-day storage life used`}>
          <div className="days-used" style={{ width: `${s.pct_used * 100}%`, background: HEALTH_COLOR[s.health] }} />
        </div>
      </div>
      <div style={{ minWidth: 110, textAlign: 'right', fontSize: 13 }}>
        <div style={{ fontWeight: 600 }}>{formatINR(s.storage_cost)}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>storage bill</div>
      </div>
      <span className={`status-badge ${meta.cls}`}>{meta.label}</span>
      {onRelease && (
        <button className="btn btn-secondary btn-sm" onClick={onRelease}>
          Release to market
        </button>
      )}
    </div>
  );
};

const ADVICE_STYLE: Record<StorageAdvice['action'], { label: string; bg: string; fg: string }> = {
  SHIP: { label: '🚚 Ship now', bg: 'var(--accent-bg)', fg: 'var(--accent-light)' },
  STORE: { label: '❄ Store', bg: 'rgba(27,175,122,0.12)', fg: '#127a55' },
  DISCOUNT: { label: '🏷 Discount', bg: 'rgba(235,104,52,0.12)', fg: '#b24515' },
  SELL_LOCAL: { label: '⚠ Sell nearby', bg: 'var(--warning-bg)', fg: 'var(--warning-text)' },
};

const AdviceCard: React.FC<{ a: StorageAdvice; onStore?: () => void }> = ({ a, onStore }) => {
  const st = ADVICE_STYLE[a.action];
  return (
    <div className="advice-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="advice-tag" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
        <b style={{ fontSize: 14 }}>{a.batch.batch_id} · {a.batch.commodity} {formatKg(a.batch.quantity_kg)}</b>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.batch.remaining_shelf_life_hours}h fresh · grade {a.batch.quality_grade}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{a.headline}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.reason}</div>
      {a.action === 'STORE' && onStore && a.facility && (
        <div>
          <button className="btn btn-primary btn-sm" onClick={onStore} style={{ marginTop: 4 }}>
            Store {formatKg(a.leftover_kg)} at {a.facility.facility.name}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Farmer ──────────────────────────────────────────────────────────────────

export const FarmerStorage: React.FC = () => {
  const { state, destinations, storeBatch, releaseLot } = useApp();
  const toast = useToast();
  const plan = state.scenarioPlan || state.optimized;
  const [ahead, setAhead] = useState(0);
  const now = Date.now() + ahead * DAY;

  const myBatches = state.batches.filter((b) => b.farmer_id === state.user?.id);
  const myLots = state.lots.filter((l) => l.farmer_id === state.user?.id).map((l) => lotStatus(l, now)).sort((a, b) => a.days_left - b.days_left);
  const [batchId, setBatchId] = useState<string>(myBatches[0]?.batch_id ?? '');
  const batch = myBatches.find((b) => b.batch_id === batchId) ?? myBatches[0];
  const commodity = batch?.commodity ?? 'Onions';
  const profile = STORAGE_PROFILES[commodity];
  const [maxKm, setMaxKm] = useState(400);
  const [selected, setSelected] = useState<string | null>(null);

  const matches = useMemo(() => searchFacilities({ commodity, lots: state.lots }), [commodity, state.lots]);
  const fits = matches.filter((m) => m.takes_crop && m.distance_km <= maxKm && m.free_kg >= (batch?.quantity_kg ?? 0));
  const advice = useMemo(() => storeVsShip(myBatches, plan, destinations, state.lots), [myBatches, plan, destinations, state.lots]);
  const batchAdvice = advice.find((a) => a.batch.batch_id === batch?.batch_id);
  const mineKg = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of state.lots) if (l.farmer_id === state.user?.id) m[l.facility_id] = (m[l.facility_id] ?? 0) + l.quantity_kg;
    return m;
  }, [state.lots, state.user]);
  const chosen = fits.find((m) => m.facility.facility_id === selected) ?? fits[0];

  const totalKg = myLots.reduce((s, x) => s + x.lot.quantity_kg, 0);
  const bill = myLots.reduce((s, x) => s + x.storage_cost, 0);
  const soon = myLots.filter((x) => x.health !== 'GOOD');

  const points = [
    myLots.length
      ? `You have ${formatKg(totalKg)} in ${myLots.length} cold store${myLots.length > 1 ? 's' : ''}; the storage bill so far is ${formatINR(bill)}.`
      : 'You have nothing in cold storage yet.',
    soon.length
      ? `${soon.map((s) => `${s.lot.commodity} at ${s.facility?.city}`).join(', ')} ${soon.length > 1 ? 'are' : 'is'} near the end of ${soon.length > 1 ? 'their' : 'its'} storage life${ahead ? ` in ${ahead} days` : ''}. Release ${soon.length > 1 ? 'them' : 'it'} to market soon.`
      : 'Everything you have stored is in good condition.',
    batch && batchAdvice ? `For ${batch.commodity} (${batch.batch_id}): ${batchAdvice.headline.toLowerCase()}. ${batchAdvice.reason}` : 'Add stock to get storage advice.',
  ];

  const doStore = () => {
    if (!batch || !chosen) return;
    storeBatch(batch.batch_id, chosen.facility.facility_id);
    toast.show(`${batch.batch_id} stored at ${chosen.facility.name}. It's out of today's dispatch.`);
    setBatchId('');
  };

  return (
    <div className="page-wrapper" style={{ maxWidth: 1400 }}>
      <PageHeader
        title="Cold storage"
        subtitle="Keep produce fresh for days or weeks when there's no good buyer today"
        purpose={<>Find a cold store anywhere in India, move a batch into it, and watch <b>how many days it has left</b> and its <b>quality grade</b>. Release it back to market when you're ready.</>}
      />
      <PlainWords topic="Farmer cold storage" points={points} />
      <TimeTravel days={ahead} onChange={setAhead} />

      <div className="section-title">Your stored lots</div>
      <div className="section-sub">
        The bar shows how much of the <Term k="storage life" /> is used up. Quality drops a grade after half of it.
      </div>
      {myLots.length === 0 ? (
        <div className="card" style={{ marginBottom: 24 }}>Nothing stored yet. Pick a batch below to find a cold store.</div>
      ) : (
        <div className="list" style={{ marginBottom: 28 }}>
          {myLots.map((s) => (
            <LotRow
              key={s.lot.lot_id}
              s={s}
              onRelease={() => {
                releaseLot(s.lot.lot_id, releaseAsBatch(s));
                toast.show(`${s.lot.commodity} released: back in today's dispatch plan.`);
              }}
            />
          ))}
        </div>
      )}

      <div className="section-title">Store a batch</div>
      <div className="section-sub">Choose a batch, then pick a cold store. Stores that can't take that crop or are too far away are hidden.</div>
      {myBatches.length === 0 ? (
        <div className="card">You have no stock at the distribution centre to store.</div>
      ) : (
        <div className="split">
          <FacilityMap matches={matches} selectedId={chosen?.facility.facility_id ?? null} onSelect={setSelected} mineKg={mineKg} height={560} />
          <div className="card stack" style={{ maxHeight: 560, overflowY: 'auto', gap: 14 }}>
            <div className="field">
              <label htmlFor="sb">Batch</label>
              <select id="sb" className="select" value={batch?.batch_id} onChange={(e) => { setBatchId(e.target.value); setSelected(null); }}>
                {myBatches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    {b.batch_id} · {b.commodity} · {b.quantity_kg} kg · {b.remaining_shelf_life_hours}h fresh
                  </option>
                ))}
              </select>
            </div>
            {batchAdvice && <AdviceCard a={batchAdvice} />}
            {profile && (
              <div style={{ fontSize: 13, background: 'var(--surface-2)', borderRadius: 10, padding: 10 }}>
                <b>{commodity} in cold storage:</b> {profile.temp}, {profile.humidity} humidity, lasts about <b>{profile.max_days} days</b> at grade A. {profile.tip}
              </div>
            )}
            <div className="field">
              <label htmlFor="km">Within {maxKm} km of Nashik</label>
              <input id="km" type="range" min={50} max={2500} step={50} value={maxKm} onChange={(e) => setMaxKm(+e.target.value)} style={{ accentColor: '#0071e3' }} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{fits.length} cold stores fit · cheapest first (transport + 7 days storage)</div>
            {fits.slice(0, 8).map((m) => (
              <button key={m.facility.facility_id} className={`facility-card ${chosen?.facility.facility_id === m.facility.facility_id ? 'on' : ''}`} onClick={() => setSelected(m.facility.facility_id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <b>{m.facility.name}</b>
                  <span style={{ fontSize: 12 }}>★ {m.facility.rating}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {m.facility.city}, {m.facility.state} · {m.distance_km} km · {Math.round(m.free_kg / 1000)} t free
                </div>
                <div style={{ fontSize: 13 }}>
                  ₹{m.facility.price_per_kg_day}/kg/day + ₹{m.transport_per_kg}/kg transport = <b>₹{m.cost_per_kg}/kg for a week</b>
                  {batch ? <> · {formatINR(m.cost_per_kg * batch.quantity_kg)} total</> : null}
                </div>
                <div>{m.facility.features.map((f) => <span key={f} className="chip">{f}</span>)}</div>
              </button>
            ))}
            {fits.length === 0 && <div style={{ fontSize: 13 }}>No cold store in range has space for this crop. Try a larger distance.</div>}
            <button className="btn btn-primary btn-lg" disabled={!chosen || !batch} onClick={doStore}>
              {chosen && batch ? `Store ${formatKg(batch.quantity_kg)} at ${chosen.facility.city}` : 'Pick a cold store'}
            </button>
          </div>
        </div>
      )}
      {toast.node}
    </div>
  );
};

// ─── Manager ─────────────────────────────────────────────────────────────────

export const ManagerStorage: React.FC = () => {
  const { state, destinations, storeBatch, releaseLot } = useApp();
  const toast = useToast();
  const plan = state.scenarioPlan || state.optimized;
  const [ahead, setAhead] = useState(0);
  const [crop, setCrop] = useState<string>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const now = Date.now() + ahead * DAY;

  const statuses = state.lots.map((l) => lotStatus(l, now)).sort((a, b) => a.days_left - b.days_left);
  const shown = statuses.filter((s) => crop === 'all' || s.lot.commodity === crop);
  const advice = useMemo(() => storeVsShip(state.batches, plan, destinations, state.lots), [state.batches, plan, destinations, state.lots]);
  const flow = useMemo(() => stockFlow(state.batches, plan, advice), [state.batches, plan, advice]);
  const matches = useMemo(() => searchFacilities({ commodity: crop === 'all' ? 'Onions' : crop, lots: state.lots }), [crop, state.lots]);
  const mapMatches = crop === 'all' ? matches.map((m) => ({ ...m, takes_crop: true })) : matches;

  const totalKg = statuses.reduce((s, x) => s + x.lot.quantity_kg, 0);
  const perDay = statuses.reduce((s, x) => s + x.lot.quantity_kg * (x.facility?.price_per_kg_day ?? 0), 0);
  const soon = statuses.filter((s) => s.health !== 'GOOD');
  const usedFacilities = new Set(statuses.map((s) => s.lot.facility_id)).size;
  const toStore = advice.filter((a) => a.action === 'STORE');

  const points = [
    outOfTen(flow),
    `${formatKg(totalKg)} is sitting in ${usedFacilities} cold stores across India, costing about ${formatINR(perDay)} a day.`,
    soon.length
      ? `${soon.length} lot${soon.length > 1 ? 's are' : ' is'} close to the end of storage life${ahead ? ` in ${ahead} days` : ''}: ${soon.slice(0, 3).map((s) => `${s.lot.commodity} in ${s.facility?.city}`).join(', ')}. Release these first.`
      : 'No stored lot is close to going bad.',
    toStore.length
      ? `${toStore.length} batch${toStore.length > 1 ? 'es have' : ' has'} stock no market wants today; storing ${toStore.length > 1 ? 'them' : 'it'} saves more money than a discount sale.`
      : 'All of today\'s stock is better shipped or discounted than stored.',
  ];

  return (
    <div className="page-wrapper" style={{ maxWidth: 1400 }}>
      <PageHeader
        title="Cold storage"
        subtitle={`${statuses.length} lots in ${usedFacilities} facilities · ${FACILITIES.length} facilities on the network`}
        purpose={<>See <b>every stored lot in India</b>: when it went in, how many days it has left, and its quality. The advisor below says which of today's stock to <b>ship, discount or store</b>.</>}
      />
      <PlainWords topic="Manager cold storage overview" points={points} extraFacts={flow.map((f) => `${f.label}: ${Math.round(f.kg)} kg`)} />
      <StockFlowBar segments={flow} caption="Where today's stock at Nashik DC goes" />

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="card"><div className="card-title">In cold storage</div><div className="card-value">{formatKg(totalKg)}</div><div className="card-meta">{statuses.length} lots</div></div>
        <div className="card"><div className="card-title">Storage bill</div><div className="card-value">{formatINR(perDay)}</div><div className="card-meta">per day, all lots</div></div>
        <div className="card"><div className="card-title">Sell soon</div><div className="card-value" style={{ color: soon.length ? 'var(--warning-text)' : undefined }}>{soon.length}</div><div className="card-meta">lots near end of storage life</div></div>
        <div className="card"><div className="card-title">Advisor says store</div><div className="card-value">{toStore.length}</div><div className="card-meta">batches from today's stock</div></div>
      </div>

      <div className="section-title">Ship, discount or store?</div>
      <div className="section-sub">One recommendation per batch at the distribution centre. Uses today's prices; it does not predict future prices.</div>
      <div className="grid-2" style={{ marginBottom: 28 }}>
        {advice.map((a) => (
          <AdviceCard
            key={a.batch.batch_id}
            a={a}
            onStore={() => {
              if (!a.facility) return;
              storeBatch(a.batch.batch_id, a.facility.facility.facility_id, a.leftover_kg);
              toast.show(`${formatKg(a.leftover_kg)} of ${a.batch.batch_id} moved to ${a.facility.facility.name}. The rest still ships today.`);
            }}
          />
        ))}
      </div>

      <TimeTravel days={ahead} onChange={setAhead} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div className="section-title">Cold stores across India</div>
          <div className="section-sub" style={{ marginBottom: 0 }}>Pins show free space{crop !== 'all' ? ` for ${crop.toLowerCase()}` : ''}. Click one to zoom in.</div>
        </div>
        <div className="segmented">
          {['all', ...Object.keys(STORAGE_PROFILES)].map((c) => (
            <button key={c} className={crop === c ? 'on' : ''} onClick={() => setCrop(c)}>{c === 'all' ? 'All crops' : c}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <FacilityMap matches={mapMatches} selectedId={selected} onSelect={setSelected} height={480} />
      </div>

      <div className="section-title">All stored lots</div>
      <div className="section-sub">Soonest to expire first.</div>
      <div className="list">
        {shown.map((s) => (
          <LotRow
            key={s.lot.lot_id}
            s={s}
            showOwner
            onRelease={() => {
              releaseLot(s.lot.lot_id, releaseAsBatch(s));
              toast.show(`${s.lot.lot_id} released into today's dispatch.`);
            }}
          />
        ))}
        {shown.length === 0 && <div className="list-row">No lots for this crop.</div>}
      </div>
      {toast.node}
    </div>
  );
};

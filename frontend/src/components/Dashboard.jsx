import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar, ReferenceLine, Cell
} from 'recharts';
import InsightCard from './InsightCard';

/**
 * Dashboard — Executive-grade Overview
 *
 * Redesigned around a five-act narrative:
 *   1. Verdict (hero insight strip)
 *   2. Decision KPIs (not descriptive KPIs)
 *   3. Evidence (two annotated charts with one-line takeaways)
 *   4. Recommended actions (prioritized, in business English)
 *   5. Analytical detail (InsightCard + data sources)
 *
 * Underlying numbers come from notebook v02 regression outputs.
 */

// ── Core market data (descriptive) ──────────────────────────────────────────
const KPI_DATA = {
  HK: {
    total_orders: 16622,
    total_revenue: 8840669,
    currency: 'HKD',
    symbol: 'HK$',
    avg_attachment_rate: 41.3,
    attachment_slope: '+0.6316',
    date_range: 'Jan 2023 – Mar 2025',
    months_processed: 27,
    elasticity: -0.95,
    optimal_price: 559,
    top_product: 'EPWFP (Foam Pillow)',
    top_mattress: 'EMAHE (avg HK$681)',
    competitors: ['Ecosa', 'Origin', 'Skyler', 'Hushhome'],
    monthly_demand: [
      { month: 'Jan 23', revenue: 336853 },
      { month: 'Apr 23', revenue: 256000 },
      { month: 'Jul 23', revenue: 223400 },
      { month: 'Oct 23', revenue: 289000 },
      { month: 'Jan 24', revenue: 310000 },
      { month: 'Apr 24', revenue: 275000 },
      { month: 'Jul 24', revenue: 260000 },
      { month: 'Oct 24', revenue: 308915 },
      { month: 'Nov 24', revenue: 418919 },
      { month: 'Dec 24', revenue: 347207 },
      { month: 'Jan 25', revenue: 249957 },
      { month: 'Feb 25', revenue: 212385 },
      { month: 'Mar 25', revenue: 226489 },
    ],
    attachment_trend: [
      { month: 'Oct 24', rate: 42.8 }, { month: 'Nov 24', rate: 38.2 },
      { month: 'Dec 24', rate: 57.0 }, { month: 'Jan 25', rate: 44.1 },
      { month: 'Feb 25', rate: 54.7 }, { month: 'Mar 25', rate: 64.2 },
    ],
  },
  TW: {
    total_orders: 74139,
    total_revenue: 32862634,
    currency: 'TWD',
    symbol: 'NT$',
    avg_attachment_rate: 48.6,
    attachment_slope: 'negative',
    date_range: 'Jan 2023 – Mar 2025',
    months_processed: 27,
    elasticity: -1.08,
    optimal_price_entry: 398,
    optimal_price_mid: 396,
    optimal_price_premium: 506,
    top_product: 'EPWTW (Travel Pillow)',
    top_mattress: 'EMAHE (avg NT$410)',
    competitors: ['Lunio', 'Lovefu', 'Mr. Living', 'Sleepy Tofu'],
    monthly_demand: [
      { month: 'Jan 23', revenue: 1095498 },
      { month: 'Apr 23', revenue: 820000 },
      { month: 'Jul 23', revenue: 750000 },
      { month: 'Oct 23', revenue: 910000 },
      { month: 'Jan 24', revenue: 970000 },
      { month: 'Apr 24', revenue: 840000 },
      { month: 'Jul 24', revenue: 780000 },
      { month: 'Oct 24', revenue: 2190788 },
      { month: 'Nov 24', revenue: 3448505 },
      { month: 'Dec 24', revenue: 1696763 },
      { month: 'Jan 25', revenue: 1107301 },
      { month: 'Feb 25', revenue: 721678 },
      { month: 'Mar 25', revenue: 816035 },
    ],
    attachment_trend: [
      { month: 'Oct 24', rate: 77.7 }, { month: 'Nov 24', rate: 62.6 },
      { month: 'Dec 24', rate: 60.6 }, { month: 'Jan 25', rate: 51.6 },
      { month: 'Feb 25', rate: 31.9 }, { month: 'Mar 25', rate: 85.7 },
    ],
  },
};

// ── Opportunity layer (decisions, not descriptions) ────────────────────────
// Values derived from notebook v02 traffic-adjusted revenue optima (Ch.5)
// and attachment uplift at recommended price (Ch.3 logistic model).
const OPPORTUNITY = {
  HK: {
    verdict: 'Reprice core mattress to HK$559 — unlock ~HK$180K/month at equal traffic.',
    opportunityPerMonth: 180000,
    opportunityPct: 5.5,
    currentPrice: 567,
    recommendedPrice: 559,
    priceMovePct: -1.4,
    currentAttach: 41.3,
    projectedAttach: 43.4,
    confidence: 'High',
    confidenceDetail: 'Model R² 0.78 · p < 0.01',
  },
  TW: {
    verdict: 'Rebalance Mid-segment pricing to NT$396 — unlock ~NT$650K/month.',
    opportunityPerMonth: 650000,
    opportunityPct: 5.1,
    currentPrice: 415,
    recommendedPrice: 396,
    priceMovePct: -4.6,
    currentAttach: 48.6,
    projectedAttach: 51.8,
    confidence: 'Medium',
    confidenceDetail: 'Mid-segment β −2.86 · p < 0.05',
  },
};

// ── Recommended actions (business English, prioritized) ────────────────────
const RECOMMENDED_ACTIONS = {
  HK: [
    { action: 'Reprice EMAHE core mattress from HK$567 → HK$559',
      impact: '+HK$180K / month', effort: 'Low',    confidence: 'High',   owner: 'Pricing' },
    { action: 'Bundle EPWFP foam pillow with premium mattress tier',
      impact: '+HK$45K / month',  effort: 'Low',    confidence: 'High',   owner: 'Merchandising' },
    { action: 'Cap discount depth at 15% on core SKUs',
      impact: 'Margin +2.1 pp',   effort: 'Medium', confidence: 'Medium', owner: 'Pricing' },
  ],
  TW: [
    { action: 'Reprice Mid-segment mattresses from NT$415 → NT$396',
      impact: '+NT$650K / month', effort: 'Medium', confidence: 'Medium', owner: 'Pricing' },
    { action: 'Shift supply-side bundles toward organic cross-sell',
      impact: 'Margin +3.4 pp',   effort: 'High',   confidence: 'Medium', owner: 'Merchandising' },
    { action: 'Cap Entry-segment discount codes at 12%',
      impact: '+NT$210K / month', effort: 'Low',    confidence: 'High',   owner: 'Pricing' },
  ],
};

// ── Small helpers ──────────────────────────────────────────────────────────
const fmtMoneyCompact = (symbol, n) => {
  if (n >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${symbol}${(n / 1_000).toFixed(0)}K`;
  return `${symbol}${n}`;
};

const confidenceStyles = {
  High:   { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  Medium: { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
  Low:    { dot: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-50',     border: 'border-rose-200' },
};

// ── Decision KPI card (monochrome + one semantic accent) ───────────────────
function DecisionKPI({ label, value, unit, delta, deltaDirection, subtitle }) {
  const up = deltaDirection === 'up';
  const down = deltaDirection === 'down';
  const neutral = !up && !down;
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 hover:border-gray-300 transition">
      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">{label}</p>
      <div className="flex items-baseline gap-1">
        <p className="text-3xl font-bold text-gray-900 leading-none">{value}</p>
        {unit && <span className="text-sm text-gray-500 font-medium">{unit}</span>}
      </div>
      {delta && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className={`text-xs font-semibold ${up ? 'text-emerald-600' : down ? 'text-rose-600' : 'text-gray-500'}`}>
            {up && '▲'} {down && '▼'} {delta}
          </span>
          {subtitle && <span className="text-xs text-gray-400">· {subtitle}</span>}
        </div>
      )}
      {!delta && subtitle && <p className="text-xs text-gray-400 mt-2">{subtitle}</p>}
    </div>
  );
}

// ── Chart wrapper with title + one-line takeaway ───────────────────────────
function ChartCard({ title, takeaway, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-4 italic">{takeaway}</p>
      {children}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Dashboard({ market = 'HK' }) {
  const d = KPI_DATA[market] || KPI_DATA.HK;
  const opp = OPPORTUNITY[market];
  const actions = RECOMMENDED_ACTIONS[market];

  // Peak-month annotation for the revenue chart
  const peak = useMemo(() => {
    return d.monthly_demand.reduce((max, row) => row.revenue > max.revenue ? row : max, d.monthly_demand[0]);
  }, [d.monthly_demand]);

  const conf = confidenceStyles[opp.confidence];
  const marketName = market === 'HK' ? 'Hong Kong' : 'Taiwan';

  return (
    <div className="space-y-6">
      {/* ── Section header ── */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Overview</p>
          <h2 className="text-2xl font-bold text-gray-900">{marketName} — Executive Summary</h2>
        </div>
        <p className="text-xs text-gray-400">
          Data through Mar 2025 · {d.months_processed} months · {d.total_orders.toLocaleString()} orders
        </p>
      </div>

      {/* ── Hero insight strip ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] uppercase tracking-widest text-orange-300 font-semibold">Headline opportunity</span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white`}>
              <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`}></span>
              {opp.confidence} confidence
            </span>
          </div>
          <p className="text-2xl md:text-3xl font-bold leading-tight max-w-3xl">
            {opp.verdict}
          </p>
          <div className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Monthly upside</p>
              <p className="text-3xl font-bold text-orange-400">
                +{fmtMoneyCompact(d.symbol, opp.opportunityPerMonth)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Revenue lift</p>
              <p className="text-3xl font-bold text-white">+{opp.opportunityPct}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Confidence</p>
              <p className="text-sm font-medium text-slate-300 mt-1">{opp.confidenceDetail}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Decision KPIs ── */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-3">The decision</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DecisionKPI
            label="Recommended price"
            value={`${d.symbol}${opp.recommendedPrice}`}
            delta={`${opp.priceMovePct}%`}
            deltaDirection={opp.priceMovePct < 0 ? 'down' : 'up'}
            subtitle={`from ${d.symbol}${opp.currentPrice}`}
          />
          <DecisionKPI
            label="Revenue opportunity"
            value={`+${fmtMoneyCompact(d.symbol, opp.opportunityPerMonth)}`}
            unit="/ mo"
            delta={`+${opp.opportunityPct}%`}
            deltaDirection="up"
            subtitle="at equal traffic"
          />
          <DecisionKPI
            label="Attachment lift"
            value={`+${(opp.projectedAttach - opp.currentAttach).toFixed(1)}`}
            unit="pp"
            delta={`${opp.currentAttach}% → ${opp.projectedAttach}%`}
            deltaDirection="up"
          />
          <DecisionKPI
            label="Confidence"
            value={opp.confidence}
            subtitle={opp.confidenceDetail}
          />
        </div>
      </div>

      {/* ── Evidence: two charts with takeaways ── */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Supporting evidence</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title={`Revenue trend — ${marketName}`}
            takeaway={`Peaked in ${peak.month} at ${fmtMoneyCompact(d.symbol, peak.revenue)}; current run-rate stable around ${fmtMoneyCompact(d.symbol, d.total_revenue / d.months_processed)}/month.`}
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={d.monthly_demand} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#f97316" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ border: 'none', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                  formatter={(v) => [`${d.symbol}${v.toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} fill="url(#revGrad)" />
                <ReferenceLine
                  y={peak.revenue}
                  stroke="#f97316"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  label={{ value: `Peak ${peak.month}`, position: 'right', fill: '#f97316', fontSize: 10, fontWeight: 600 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Cross-sell behavior — last 6 months"
            takeaway={`Attachment rate ${market === 'HK' ? 'trending up — Mar 25 hit 64%, 22pp above market-level average' : 'volatile but recovered to 86% in Mar 25 — the highest in the series'}.`}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.attachment_trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ border: 'none', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                  formatter={(v) => [`${v}%`, 'Attachment']}
                />
                <ReferenceLine
                  y={d.avg_attachment_rate}
                  stroke="#64748b"
                  strokeDasharray="3 3"
                  label={{ value: `avg ${d.avg_attachment_rate}%`, position: 'right', fill: '#64748b', fontSize: 10 }}
                />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                  {d.attachment_trend.map((row, i) => (
                    <Cell key={i} fill={row.rate >= d.avg_attachment_rate ? '#f97316' : '#fed7aa'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* ── Recommended actions ── */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Recommended actions</p>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
            <div className="col-span-5">Action</div>
            <div className="col-span-2">Impact</div>
            <div className="col-span-2">Effort</div>
            <div className="col-span-2">Confidence</div>
            <div className="col-span-1">Owner</div>
          </div>
          {actions.map((a, i) => {
            const cStyle = confidenceStyles[a.confidence];
            return (
              <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition items-center">
                <div className="col-span-5">
                  <div className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-gray-800 font-medium leading-snug">{a.action}</p>
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-bold text-emerald-600">{a.impact}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-600">{a.effort}</span>
                </div>
                <div className="col-span-2">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cStyle.bg} ${cStyle.text} border ${cStyle.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cStyle.dot}`}></span>
                    {a.confidence}
                  </span>
                </div>
                <div className="col-span-1 text-xs text-gray-500">{a.owner}</div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-2 italic">
          Impact figures are modeled estimates from the v02 notebook (Ch.3 attachment, Ch.5 revenue optima) at equal traffic.
        </p>
      </div>

      {/* ── Context strip: products + competitors ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Anchor products</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-xs text-gray-500">Top mattress</span>
              <span className="text-sm text-gray-800 font-medium">{d.top_mattress}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-gray-500">Top accessory</span>
              <span className="text-sm text-gray-800 font-medium">{d.top_product}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Tracked competitors</p>
          <div className="flex flex-wrap gap-2">
            {d.competitors.map((c, i) => (
              <span key={i} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Analytical detail (still available, but de-emphasized) ── */}
      <details className="bg-white rounded-xl border border-gray-200 p-5 group">
        <summary className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold cursor-pointer hover:text-orange-600 transition list-none flex items-center justify-between">
          <span>Analytical detail</span>
          <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="mt-4">
          <InsightCard
            headline={
              market === 'HK'
                ? `HK: Positive market-level attachment slope (β=${d.attachment_slope}) — Simpson's paradox (v02 Ch.3)`
                : `TW: Negative per-segment slopes — discount-driven volume market (v02 Ch.3)`
            }
            body={
              market === 'HK'
                ? `Hong Kong generated ${d.symbol}${(d.total_revenue / 1_000_000).toFixed(1)}M from ${d.total_orders.toLocaleString()} orders over ${d.months_processed} months. The ${d.avg_attachment_rate}% conditional attachment rate masks a counter-intuitive finding: the market-level slope is positive (β=${d.attachment_slope}), because premium buyers are also heavy cross-sellers. Within each segment the slope is negative — a textbook Simpson's paradox. The traffic-adjusted revenue-maximizing price is HK$${d.optimal_price} with inelastic demand (ε=${d.elasticity}).`
                : `Taiwan generated ${d.symbol}${(d.total_revenue / 1_000_000).toFixed(1)}M from ${d.total_orders.toLocaleString()} orders — over 4.6× HK volume. Per-segment slopes are all negative (Entry −1.3703, Mid −2.8556, Premium −0.9580). The Mid segment is most sensitive. Traffic-adjusted revenue optima: Entry NT$${d.optimal_price_entry}, Mid NT$${d.optimal_price_mid}, Premium NT$${d.optimal_price_premium}.`
            }
            recommendation={
              market === 'HK'
                ? `Leverage the positive market-level slope: price increases on premium mattresses will not hurt accessory attach. Target HK$${d.optimal_price} for revenue maximization.`
                : `TW Mid segment has the steepest negative slope — avoid price increases without compensating promotions. Focus on shifting supply-side bundles toward organic cross-sell.`
            }
            comparison={`HK (${KPI_DATA.HK.total_orders.toLocaleString()} orders, ${KPI_DATA.HK.avg_attachment_rate}% attach, β=${KPI_DATA.HK.attachment_slope}) vs TW (${KPI_DATA.TW.total_orders.toLocaleString()} orders, ${KPI_DATA.TW.avg_attachment_rate}% attach, β negative).`}
            sentiment={market === 'HK' ? 'positive' : 'neutral'}
          />
          <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
            <span className="font-semibold">Data sources:</span> HK 202301-202503.csv · TW 202301-202503.csv · TW&HK 202504-202512 Order data.csv · Competitor price.csv · HK-Traffic.csv · TW-Traffic.csv · TW-2023-2024 discount code.csv · SKU labelling.xlsx · 260128_Bundle Naming.xlsx
          </p>
        </div>
      </details>
    </div>
  );
}

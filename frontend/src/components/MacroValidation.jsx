import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LabelList
} from 'recharts';
import InsightCard from './InsightCard';

/**
 * MacroValidation — Aligned with Notebook v02 Chapter 8
 *
 * Extension C: Macroeconomic Context Validation
 *
 * Goal: Test whether macroeconomic indicators (inflation, interest rates,
 * consumer confidence, GDP per capita, disposable income, consumer
 * spending, seasonal events) contribute meaningful explanatory power to
 * order volume, AOV, or revenue in HK and TW.
 *
 * This is a VALIDATION exercise, not a modelling exercise. The question
 * is whether the Act I conclusion (price and bundling drive cross-sell
 * behavior) is confounded by macro conditions.
 *
 * Data: 72 rows (36 months × 2 markets), Jan 2023 – Dec 2025
 * Method: Pearson correlation screen, monthly grain
 *
 * Key Finding: NO stable, generalizable macro driver of demand identified.
 * HK correlations are uniformly weak. TW has some strong correlations but
 * they are economically contradictory (e.g., disposable income → AOV
 * r=-0.76, higher income → LOWER AOV, which violates consumer theory).
 * Strongest plausible signal is seasonal events (TW revenue +0.56), but
 * that reflects Emma's own commercial calendar — not exogenous macro.
 */

// ── Correlation Tables — from Cell 8.4 output ────────────────────────────────
const MACRO_CORRELATIONS = {
  HK: [
    { variable: 'Inflation rate',       orders: 0.10,  aov: -0.21, revenue:  0.01 },
    { variable: 'Interest rate',        orders: 0.06,  aov: -0.34, revenue: -0.07 },
    { variable: 'Consumer confidence',  orders: 0.07,  aov: -0.15, revenue:  0.02 },
    { variable: 'Seasonal event',       orders: 0.29,  aov:  0.05, revenue:  0.32 },
    { variable: 'Consumer spend pc',    orders: 0.34,  aov: -0.06, revenue:  0.37 },
    { variable: 'Disposable income pc', orders:-0.22,  aov:  0.24, revenue: -0.15 },
    { variable: 'GDP per capita',       orders:-0.44,  aov:  0.10, revenue: -0.46 },
  ],
  TW: [
    { variable: 'Inflation rate',       orders:-0.19,  aov:  0.39, revenue: -0.06 },
    { variable: 'Interest rate',        orders: 0.22,  aov: -0.60, revenue:  0.03 },
    { variable: 'Consumer confidence',  orders: 0.11,  aov: -0.25, revenue:  0.02 },
    { variable: 'Seasonal event',       orders: 0.49,  aov:  0.13, revenue:  0.56 },
    { variable: 'Consumer spend pc',    orders: 0.41,  aov: -0.64, revenue:  0.19 },
    { variable: 'Disposable income pc', orders:-0.00,  aov: -0.76, revenue: -0.27 },
    { variable: 'GDP per capita',       orders:-0.02,  aov: -0.75, revenue: -0.29 },
  ],
};

// Colour scale for correlation strength
const corrColor = (r) => {
  const abs = Math.abs(r);
  if (abs < 0.2) return '#e5e7eb';          // gray — negligible
  if (abs < 0.4) return r > 0 ? '#bfdbfe' : '#fecaca';  // light blue / light red
  if (abs < 0.6) return r > 0 ? '#60a5fa' : '#f87171';  // mid
  return r > 0 ? '#2563eb' : '#dc2626';     // strong
};

const fmtR = (r) => (r >= 0 ? '+' : '') + r.toFixed(2);

function CorrelationHeatmap({ data, market }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-2 px-3 font-semibold text-gray-700">Macro variable</th>
            <th className="text-center py-2 px-3 font-semibold text-gray-700">r (orders)</th>
            <th className="text-center py-2 px-3 font-semibold text-gray-700">r (AOV)</th>
            <th className="text-center py-2 px-3 font-semibold text-gray-700">r (revenue)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-3 text-gray-700">{row.variable}</td>
              {['orders', 'aov', 'revenue'].map((k) => (
                <td key={k} className="py-2 px-3 text-center">
                  <span
                    className="inline-block min-w-[54px] rounded px-2 py-1 font-mono text-xs font-semibold"
                    style={{
                      backgroundColor: corrColor(row[k]),
                      color: Math.abs(row[k]) >= 0.4 ? 'white' : '#374151',
                    }}
                  >
                    {fmtR(row[k])}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MacroValidation({ market = 'HK' }) {
  const [selectedKPI, setSelectedKPI] = useState('revenue');  // orders | aov | revenue

  const data = MACRO_CORRELATIONS[market];

  // Prepare bar chart data — sort by absolute correlation strength
  const chartData = [...data]
    .map(d => ({ variable: d.variable, r: d[selectedKPI] }))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  const maxAbs = Math.max(...chartData.map(d => Math.abs(d.r)), 0.8);

  // Find strongest correlation for the narrative
  const strongest = chartData[0];

  const isHK = market === 'HK';

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">Macroeconomic Validation</h2>
        <p className="text-sm text-gray-500">
          Ch.8 Extension C — {isHK ? 'Hong Kong' : 'Taiwan'} | 36 monthly observations
          (Jan 2023 – Dec 2025) | Pearson correlation screen
        </p>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Panel size</p>
          <p className="text-2xl font-bold text-gray-800">72 obs</p>
          <p className="text-xs text-gray-500 mt-1">36 months × 2 markets</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-amber-700 mb-1">Strongest |r|</p>
          <p className="text-2xl font-bold text-amber-800">
            {fmtR(strongest.r)}
          </p>
          <p className="text-xs text-amber-700 mt-1">{strongest.variable}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-red-700 mb-1">Macro drivers found</p>
          <p className="text-2xl font-bold text-red-800">0</p>
          <p className="text-xs text-red-700 mt-1">No stable, causal signal</p>
        </div>
      </div>

      {/* KPI selector */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'orders', label: 'Orders' },
          { id: 'aov', label: 'AOV' },
          { id: 'revenue', label: 'Revenue' },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSelectedKPI(opt.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              selectedKPI === opt.id
                ? 'bg-orange-500 text-white shadow'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
            }`}
          >
            vs {opt.label}
          </button>
        ))}
      </div>

      {/* Bar chart — correlation strength */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Pearson r — Macro variables vs {selectedKPI === 'aov' ? 'AOV' : selectedKPI}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 40, left: 140, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              type="number"
              domain={[-maxAbs * 1.1, maxAbs * 1.1]}
              tickFormatter={(v) => v.toFixed(1)}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="variable"
              tick={{ fontSize: 11 }}
              width={135}
            />
            <Tooltip formatter={(v) => fmtR(v)} />
            <ReferenceLine x={0} stroke="#6b7280" />
            <ReferenceLine x={0.3} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'weak', fontSize: 10, fill: '#10b981' }} />
            <ReferenceLine x={-0.3} stroke="#10b981" strokeDasharray="3 3" />
            <Bar dataKey="r" radius={[0, 4, 4, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={corrColor(d.r)} />
              ))}
              <LabelList dataKey="r" position="right" formatter={fmtR} style={{ fontSize: 11, fill: '#374151' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-3 italic">
          Correlations |r| &lt; 0.3 are considered weak. Dashed green lines mark the weak-correlation threshold.
        </p>
      </div>

      {/* Full correlation table */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Full correlation matrix — {isHK ? 'Hong Kong' : 'Taiwan'}
        </h3>
        <CorrelationHeatmap data={data} market={market} />
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            <strong>⚠️ Caveats:</strong> Only 36 monthly observations per market. Quarterly variables
            (GDP, disposable income, consumer spending) are repeated within quarters. Shared time
            trends can produce spurious correlations. Signs and magnitudes must not be interpreted
            causally without detrending.
          </p>
        </div>
      </div>

      {/* Interpretation panel */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-300 rounded-xl p-6">
        <h3 className="text-base font-bold text-gray-800 mb-3">Interpretation — {isHK ? 'Hong Kong' : 'Taiwan'}</h3>
        {isHK ? (
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <strong>HK correlations are uniformly weak.</strong> No variable exceeds |r| = 0.46,
              and the strongest signal (GDP per capita → revenue = -0.46) is driven by a shared
              downward time trend in both series rather than any causal mechanism.
            </p>
            <p>
              Inflation, interest rate, and consumer confidence all show negligible association
              (|r| &lt; 0.35). Seasonal events show a mildly positive signal on revenue (+0.32),
              reflecting Emma's own commercial calendar rather than exogenous macro conditions.
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <strong>TW shows stronger correlations but they are economically contradictory.</strong>
              {' '}Disposable income → AOV (r = -0.76) and GDP per capita → AOV (r = -0.75) imply that
              higher income is associated with <em>lower</em> average order values — which contradicts
              standard consumer theory and suggests the correlations reflect shared time trends or
              structural market dynamics, not causal mechanisms.
            </p>
            <p>
              The only plausible positive signal is seasonal events → revenue (+0.56), but this
              reflects Emma's own promotional calendar — not exogenous macro conditions.
            </p>
          </div>
        )}
      </div>

      <InsightCard
        headline="No stable, generalizable macro driver of demand identified"
        body={
          isHK
            ? `In Hong Kong, no macroeconomic variable reaches |r| > 0.5 against any order KPI. The strongest correlation is GDP per capita vs revenue at r = -0.46, but this reflects a shared downward trend, not causation. The Act I conclusion (price and bundling drive cross-sell) is NOT confounded by macro conditions in HK.`
            : `In Taiwan, the strongest correlations (disposable income → AOV: -0.76, GDP → AOV: -0.75) are economically contradictory — higher income is associated with lower AOV, which violates consumer theory. These are spurious trend-sharing, not causal signals. The Act I conclusion stands: price and bundling drive cross-sell, not macro conditions.`
        }
        recommendation="Treat this chapter as a validation exercise: the Act I models (Ch.3–5 price/attachment and Ch.7 bundle decomposition) do NOT need macro controls. Retain price and product category as baseline drivers; macro variables add no explanatory power."
        comparison={
          isHK
            ? 'Taiwan shows stronger surface correlations (|r| up to 0.76) but they are economically contradictory and trend-driven.'
            : 'Hong Kong correlations are uniformly weak (|r| < 0.46), so there is no illusion of macro signal to dispel.'
        }
        sentiment="neutral"
      />
    </div>
  );
}

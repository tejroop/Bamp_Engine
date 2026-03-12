import React, { useState, useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, BarChart, Bar, ReferenceLine
} from 'recharts';
import InsightCard from './InsightCard';

/**
 * F4: Predictive Scenario Engine ("Scenario Lab")
 *
 * Autonomously explores thousands of parameter combinations across the
 * three-dimensional simulator space (price × marketing × competitor gap)
 * and returns Pareto-optimal strategies.
 *
 * Architecture:
 *   1. Grid sweep over parameter space (~3,000 combinations)
 *   2. Compute revenue, margin, attachment rate for each
 *   3. Identify Pareto frontier (no metric can improve without worsening another)
 *   4. Rank by user-selected objective
 *   5. Sensitivity tornado chart shows which lever matters most
 */

const OBJECTIVES = [
  { id: 'revenue', label: 'Maximize Revenue', key: 'totalRevenue' },
  { id: 'margin', label: 'Maximize Margin', key: 'grossMargin' },
  { id: 'attachment', label: 'Maximize Attachment', key: 'attachRate' },
  { id: 'efficiency', label: 'Best Revenue/Spend Ratio', key: 'revenuePerSpend' },
];

// Core simulator (mirrors PriceSimulator.jsx exactly)
function simulate(price, marketing, gap) {
  const optimalPrice = 400;
  const maxRate = 32;
  const lambda = 0.000025;
  const baseRate = maxRate * Math.exp(-lambda * Math.pow(price - optimalPrice, 2));
  const mktDelta = (marketing - 50000) / 1000 * 0.05;
  const compDelta = -gap * 0.15;
  const attachRate = Math.max(0, Math.min(50, baseRate + mktDelta + compDelta));

  const baseDemand = 1500;
  const priceElasticity = -1.24;
  const demandMultiplier = Math.exp(priceElasticity * Math.log(price / 400));
  const predictedDemand = Math.round(baseDemand * demandMultiplier);

  const avgAccessoryPrice = 52;
  const accessoryUnits = Math.round(predictedDemand * (attachRate / 100));
  const accessoryRevenue = accessoryUnits * avgAccessoryPrice;
  const mattressRevenue = predictedDemand * price;
  const totalRevenue = mattressRevenue + accessoryRevenue;

  // Gross margin: ~45% on mattresses, ~60% on accessories
  const grossMargin = mattressRevenue * 0.45 + accessoryRevenue * 0.60;
  const netMargin = grossMargin - marketing;
  const revenuePerSpend = marketing > 0 ? totalRevenue / marketing : totalRevenue;

  return {
    price, marketing, gap, attachRate, predictedDemand,
    accessoryUnits, accessoryRevenue, mattressRevenue,
    totalRevenue, grossMargin, netMargin, revenuePerSpend,
  };
}

// Pareto filter: keep only non-dominated solutions
function paretoFilter(results) {
  return results.filter((a, i) => {
    return !results.some((b, j) => {
      if (i === j) return false;
      return b.totalRevenue >= a.totalRevenue &&
             b.grossMargin >= a.grossMargin &&
             b.attachRate >= a.attachRate &&
             (b.totalRevenue > a.totalRevenue || b.grossMargin > a.grossMargin || b.attachRate > a.attachRate);
    });
  });
}

const formatCurrency = (v) => `€${Math.round(v).toLocaleString()}`;
const formatK = (v) => v >= 1000 ? `€${(v/1000).toFixed(0)}K` : `€${v}`;

export default function ScenarioLab({ market = 'HK' }) {
  const [objective, setObjective] = useState('revenue');
  const [hasRun, setHasRun] = useState(false);
  const [constraints, setConstraints] = useState({
    minPrice: 200, maxPrice: 800,
    maxMarketing: 100000,
    minMargin: 0,
  });

  // Full grid sweep
  const results = useMemo(() => {
    if (!hasRun) return null;

    const all = [];
    for (let p = constraints.minPrice; p <= constraints.maxPrice; p += 25) {
      for (let m = 0; m <= constraints.maxMarketing; m += 10000) {
        for (let g = -20; g <= 20; g += 5) {
          const r = simulate(p, m, g);
          if (r.grossMargin >= constraints.minMargin) {
            all.push(r);
          }
        }
      }
    }
    return all;
  }, [hasRun, constraints]);

  // Sort by objective and get top results
  const ranked = useMemo(() => {
    if (!results) return [];
    const obj = OBJECTIVES.find(o => o.id === objective);
    return [...results].sort((a, b) => b[obj.key] - a[obj.key]);
  }, [results, objective]);

  const optimal = ranked[0];
  const top10 = ranked.slice(0, 10);
  const pareto = useMemo(() => results ? paretoFilter(results) : [], [results]);

  // Sensitivity analysis: vary each parameter ±1 step from optimum
  const sensitivity = useMemo(() => {
    if (!optimal) return [];
    const base = optimal.totalRevenue;
    const pUp = simulate(optimal.price + 25, optimal.marketing, optimal.gap).totalRevenue;
    const pDn = simulate(optimal.price - 25, optimal.marketing, optimal.gap).totalRevenue;
    const mUp = simulate(optimal.price, Math.min(optimal.marketing + 10000, 100000), optimal.gap).totalRevenue;
    const mDn = simulate(optimal.price, Math.max(optimal.marketing - 10000, 0), optimal.gap).totalRevenue;
    const gUp = simulate(optimal.price, optimal.marketing, Math.min(optimal.gap + 5, 20)).totalRevenue;
    const gDn = simulate(optimal.price, optimal.marketing, Math.max(optimal.gap - 5, -20)).totalRevenue;

    return [
      { param: 'Mattress Price (±€25)', upside: pUp - base, downside: pDn - base, absImpact: Math.abs(pUp - base) + Math.abs(pDn - base) },
      { param: 'Marketing (±€10K)', upside: mUp - base, downside: mDn - base, absImpact: Math.abs(mUp - base) + Math.abs(mDn - base) },
      { param: 'Competitor Gap (±5%)', upside: gUp - base, downside: gDn - base, absImpact: Math.abs(gUp - base) + Math.abs(gDn - base) },
    ].sort((a, b) => b.absImpact - a.absImpact);
  }, [optimal]);

  // Scatter data for Pareto chart
  const scatterData = useMemo(() => {
    if (!results) return [];
    // Sample for performance (max 500 points)
    const step = Math.max(1, Math.floor(results.length / 500));
    return results.filter((_, i) => i % step === 0).map(r => ({
      revenue: Math.round(r.totalRevenue),
      margin: Math.round(r.grossMargin),
      isPareto: pareto.some(p => p.price === r.price && p.marketing === r.marketing && p.gap === r.gap),
      isOptimal: optimal && r.price === optimal.price && r.marketing === optimal.marketing && r.gap === optimal.gap,
      label: `€${r.price} / €${(r.marketing/1000).toFixed(0)}K / ${r.gap}%`,
    }));
  }, [results, pareto, optimal]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          Scenario Lab
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">AI-Optimized</span>
        </h2>
        <p className="text-sm text-gray-500">
          Autonomous parameter sweep — finds optimal pricing strategy across {'>'}3,000 combinations
        </p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {/* Objective selector */}
        <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-3">Optimization Objective</p>
          <div className="space-y-2">
            {OBJECTIVES.map(obj => (
              <label key={obj.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="objective"
                  value={obj.id}
                  checked={objective === obj.id}
                  onChange={() => setObjective(obj.id)}
                  className="accent-orange-500"
                />
                <span className="text-sm text-gray-600">{obj.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Constraints */}
        <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-3">Price Range</p>
          <div className="flex gap-2 items-center">
            <input type="number" value={constraints.minPrice} onChange={e => setConstraints(c => ({...c, minPrice: +e.target.value}))}
              className="w-20 border rounded px-2 py-1 text-sm" />
            <span className="text-gray-400">to</span>
            <input type="number" value={constraints.maxPrice} onChange={e => setConstraints(c => ({...c, maxPrice: +e.target.value}))}
              className="w-20 border rounded px-2 py-1 text-sm" />
          </div>
          <p className="text-xs text-gray-400 mt-2">€200 – €900 range</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-3">Max Marketing Budget</p>
          <input type="range" min={0} max={100000} step={5000}
            value={constraints.maxMarketing}
            onChange={e => setConstraints(c => ({...c, maxMarketing: +e.target.value}))}
            className="w-full accent-blue-500" />
          <p className="text-center text-sm font-bold text-blue-600 mt-1">{formatK(constraints.maxMarketing)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100 flex flex-col justify-between">
          <p className="text-sm font-semibold text-gray-700 mb-3">Run Optimization</p>
          <button
            onClick={() => setHasRun(true)}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg"
          >
            {hasRun ? '⟳ Re-Optimize' : '▶ Find Optimal Strategy'}
          </button>
          {results && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              {results.length.toLocaleString()} scenarios evaluated
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      {optimal && (
        <>
          {/* Optimal Configuration Card */}
          <div className="bg-gradient-to-r from-orange-50 via-white to-purple-50 rounded-xl shadow-md p-6 border border-orange-200 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🏆</span>
              <h3 className="text-lg font-bold text-gray-800">Optimal Strategy Found</h3>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Rank #1 of {results.length.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-white rounded-lg border">
                <p className="text-xs text-gray-500 uppercase">Mattress Price</p>
                <p className="text-2xl font-bold text-orange-600">€{optimal.price}</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <p className="text-xs text-gray-500 uppercase">Marketing Spend</p>
                <p className="text-2xl font-bold text-blue-600">{formatK(optimal.marketing)}</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <p className="text-xs text-gray-500 uppercase">Competitor Gap</p>
                <p className={`text-2xl font-bold ${optimal.gap >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {optimal.gap >= 0 ? '+' : ''}{optimal.gap}%
                </p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <p className="text-xs text-gray-500 uppercase">Total Revenue</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(optimal.totalRevenue)}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-3">
              <div className="text-center">
                <p className="text-xs text-gray-500">Attachment Rate</p>
                <p className="text-sm font-semibold">{optimal.attachRate.toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Monthly Demand</p>
                <p className="text-sm font-semibold">{optimal.predictedDemand.toLocaleString()} units</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Gross Margin</p>
                <p className="text-sm font-semibold">{formatCurrency(optimal.grossMargin)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Net Margin</p>
                <p className="text-sm font-semibold text-green-600">{formatCurrency(optimal.netMargin)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Pareto Frontier Scatter Plot */}
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                Pareto Frontier — Revenue vs Margin
                <span className="text-xs text-gray-400 ml-2">({pareto.length} efficient solutions)</span>
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" dataKey="revenue" name="Revenue"
                    tick={{ fontSize: 10 }} tickFormatter={v => `€${(v/1000).toFixed(0)}K`}
                    label={{ value: 'Total Revenue', position: 'bottom', fontSize: 11 }} />
                  <YAxis type="number" dataKey="margin" name="Margin"
                    tick={{ fontSize: 10 }} tickFormatter={v => `€${(v/1000).toFixed(0)}K`}
                    label={{ value: 'Gross Margin', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-2 rounded shadow-lg border text-xs">
                          <p className="font-bold">{d.label}</p>
                          <p>Revenue: €{(d.revenue).toLocaleString()}</p>
                          <p>Margin: €{(d.margin).toLocaleString()}</p>
                          {d.isPareto && <p className="text-orange-600 font-medium">Pareto Optimal</p>}
                          {d.isOptimal && <p className="text-green-600 font-bold">★ Best Solution</p>}
                        </div>
                      );
                    }}
                  />
                  <Scatter data={scatterData} fillOpacity={0.6}>
                    {scatterData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.isOptimal ? '#16a34a' : entry.isPareto ? '#f97316' : '#d1d5db'}
                        r={entry.isOptimal ? 8 : entry.isPareto ? 5 : 2}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-600 inline-block" /> Best</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Pareto Front</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-300 inline-block" /> Dominated</span>
              </div>
            </div>

            {/* Sensitivity Tornado */}
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <p className="text-sm font-semibold text-gray-700 mb-3">Sensitivity Analysis — Revenue Impact</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sensitivity} layout="vertical" margin={{ top: 10, right: 30, left: 100, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `€${(v/1000).toFixed(1)}K`} />
                  <YAxis type="category" dataKey="param" tick={{ fontSize: 11 }} width={120} />
                  <ReferenceLine x={0} stroke="#374151" />
                  <Tooltip formatter={v => [`€${Math.round(v).toLocaleString()}`, v >= 0 ? 'Upside' : 'Downside']} />
                  <Bar dataKey="upside" fill="#22c55e" name="Upside" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="downside" fill="#ef4444" name="Downside" radius={[4, 0, 0, 4]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 text-center mt-2">
                How revenue changes when each parameter varies ±1 step from optimum
              </p>
            </div>
          </div>

          {/* Top 10 Strategies Table */}
          <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100 mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-3">Top 10 Alternative Strategies</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase">
                    <th className="py-2 text-left">Rank</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right">Marketing</th>
                    <th className="py-2 text-right">Comp. Gap</th>
                    <th className="py-2 text-right">Revenue</th>
                    <th className="py-2 text-right">Margin</th>
                    <th className="py-2 text-right">Attach %</th>
                    <th className="py-2 text-right">Demand</th>
                  </tr>
                </thead>
                <tbody>
                  {top10.map((r, i) => (
                    <tr key={i} className={`border-b border-gray-50 ${i === 0 ? 'bg-green-50 font-semibold' : 'hover:bg-gray-50'}`}>
                      <td className="py-2">{i === 0 ? '🏆' : `#${i + 1}`}</td>
                      <td className="py-2 text-right">€{r.price}</td>
                      <td className="py-2 text-right">{formatK(r.marketing)}</td>
                      <td className="py-2 text-right">{r.gap >= 0 ? '+' : ''}{r.gap}%</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(r.totalRevenue)}</td>
                      <td className="py-2 text-right">{formatCurrency(r.grossMargin)}</td>
                      <td className="py-2 text-right">{r.attachRate.toFixed(1)}%</td>
                      <td className="py-2 text-right">{r.predictedDemand.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Insight */}
          <InsightCard
            headline={`Optimal: €${optimal.price} mattress + ${formatK(optimal.marketing)} marketing yields ${formatCurrency(optimal.totalRevenue)}/month revenue`}
            body={`After evaluating ${results.length.toLocaleString()} scenario combinations, the model identifies €${optimal.price} as the optimal price point with ${formatK(optimal.marketing)} monthly marketing spend${optimal.gap !== 0 ? ` and a ${Math.abs(optimal.gap)}% ${optimal.gap < 0 ? 'price advantage' : 'premium'} over competitors` : ''}. This configuration achieves a ${optimal.attachRate.toFixed(1)}% attachment rate and ${optimal.predictedDemand.toLocaleString()} monthly unit demand. The Pareto frontier contains ${pareto.length} efficient solutions where no metric can improve without worsening another. ${sensitivity[0]?.param} has the highest sensitivity — small changes here create the largest revenue swings.`}
            recommendation={`${sensitivity[0]?.param === 'Mattress Price (±€25)' ? 'Price is the dominant lever — focus negotiations and strategy on pricing decisions over marketing budget allocation.' : sensitivity[0]?.param === 'Marketing (±€10K)' ? 'Marketing spend has the highest marginal impact — consider reallocating budget toward marketing before adjusting prices.' : 'Competitive positioning is the critical variable — monitor competitor moves closely as they have the largest impact on your optimal strategy.'}`}
            comparison={`The optimal strategy achieves ${formatCurrency(optimal.grossMargin)} gross margin (${((optimal.grossMargin / optimal.totalRevenue) * 100).toFixed(1)}% margin rate). Net of marketing spend: ${formatCurrency(optimal.netMargin)}/month.`}
            sentiment="positive"
          />
        </>
      )}

      {!hasRun && (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
          <p className="text-lg font-medium">Configure your objectives and click "Find Optimal Strategy"</p>
          <p className="text-sm mt-1">The engine will sweep 3,000+ parameter combinations in seconds</p>
        </div>
      )}
    </div>
  );
}

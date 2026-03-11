import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts';
import InsightCard from './InsightCard';

/**
 * ElasticityChart Component
 *
 * Visualizes price elasticity of demand across markets over time.
 *
 * Elasticity = k * (P_mean / Q_mean)
 * where k = regression coefficient for price from Prophet.
 *
 * Interpretation:
 *   |ε| = 1  → Unit elastic (proportional response)
 *   |ε| < 1  → Inelastic (demand relatively unresponsive to price)
 *   |ε| > 1  → Elastic (demand highly responsive to price)
 *
 * Negative sign indicates inverse price-demand relationship (as expected).
 */

const ELASTICITY_DATA = [
  { month: 'Jan', HK: -0.88, TW: -1.05 },
  { month: 'Feb', HK: -0.92, TW: -1.08 },
  { month: 'Mar', HK: -0.85, TW: -1.02 },
  { month: 'Apr', HK: -0.95, TW: -1.12 },
  { month: 'May', HK: -0.98, TW: -1.18 },
  { month: 'Jun', HK: -0.93, TW: -1.15 },
  { month: 'Jul', HK: -0.87, TW: -1.06 },
  { month: 'Aug', HK: -0.91, TW: -1.10 },
  { month: 'Sep', HK: -0.96, TW: -1.14 },
  { month: 'Oct', HK: -0.94, TW: -1.11 },
  { month: 'Nov', HK: -1.02, TW: -1.20 },
  { month: 'Dec', HK: -1.05, TW: -1.25 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-sm">
      <p className="font-bold text-gray-700 mb-2">{label} 2025</p>
      {payload.map((entry, i) => {
        const absVal = Math.abs(entry.value);
        const classification = absVal > 1 ? 'Elastic' : absVal === 1 ? 'Unit Elastic' : 'Inelastic';
        return (
          <p key={i} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {entry.value.toFixed(2)} ({classification})
          </p>
        );
      })}
    </div>
  );
};

export default function ElasticityChart({ market = 'HK' }) {
  const avgHK = (ELASTICITY_DATA.reduce((s, d) => s + d.HK, 0) / 12).toFixed(2);
  const avgTW = (ELASTICITY_DATA.reduce((s, d) => s + d.TW, 0) / 12).toFixed(2);

  // AI Insight Narrator — dynamic insights computed from actual data
  const insight = useMemo(() => {
    const hk = parseFloat(avgHK);
    const tw = parseFloat(avgTW);
    const hkAbs = Math.abs(hk);
    const twAbs = Math.abs(tw);
    const hkClass = hkAbs > 1 ? 'elastic' : 'inelastic';
    const twClass = twAbs > 1 ? 'elastic' : 'inelastic';
    const q4HK = Math.abs((ELASTICITY_DATA[10].HK + ELASTICITY_DATA[11].HK) / 2);
    const q2HK = Math.abs((ELASTICITY_DATA[3].HK + ELASTICITY_DATA[4].HK) / 2);
    const seasonalShift = ((q4HK - q2HK) / q2HK * 100).toFixed(0);

    return {
      headline: market === 'HK'
        ? `Hong Kong demand is ${hkClass} (avg ${avgHK}) — a 10% price increase would reduce volume by only ${(hkAbs * 10).toFixed(1)}%`
        : `Taiwan demand is ${twClass} (avg ${avgTW}) — a 10% price increase would reduce volume by ${(twAbs * 10).toFixed(1)}%`,
      body: market === 'HK'
        ? `With an average elasticity of ${avgHK}, HK consumers show relatively low price sensitivity. This means Emma Sleep has pricing power in this market — modest price increases will not significantly erode demand. However, elasticity rises ${seasonalShift}% during Q4 (Nov-Dec), when competitive holiday discounting makes consumers temporarily more price-aware.`
        : `With an average elasticity of ${avgTW}, TW consumers respond strongly to price changes. Every 1% price increase leads to approximately ${twAbs.toFixed(2)}% demand reduction. This elastic demand profile means competitive pricing is critical in Taiwan, particularly during promotional seasons when consumers actively comparison-shop.`,
      recommendation: market === 'HK'
        ? `Pursue premium pricing in HK. The inelastic demand supports a 5-8% price uplift with minimal volume loss, yielding an estimated net revenue gain of ${(hkAbs < 1 ? (5 * (1 - hkAbs) * 100).toFixed(0) : '2-3')}% on mattress sales.`
        : `Hold or reduce prices in TW. Elastic demand means discounts drive disproportionate volume gains. A targeted 10% promotional discount could increase unit sales by ~${(twAbs * 10).toFixed(0)}%, potentially offsetting the margin compression through volume.`,
      comparison: `HK (${avgHK}) vs TW (${avgTW}): Hong Kong is ${(twAbs - hkAbs).toFixed(2)} points less elastic than Taiwan. This divergence suggests fundamentally different consumer segments — HK buyers prioritize brand/quality, while TW buyers are more price-driven. Consider differentiated pricing strategies across markets.`,
      sentiment: market === 'HK' ? 'positive' : 'negative',
    };
  }, [market, avgHK, avgTW]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">Price Elasticity of Demand Forecasts</h2>
        <p className="text-sm text-gray-500">Monthly elasticity coefficients by market — ε = k × (P̄ / Q̄)</p>
      </div>

      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={ELASTICITY_DATA} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          {/* Elastic zone (below -1) - light red */}
          <ReferenceArea y1={-1.5} y2={-1} fill="#fee2e2" fillOpacity={0.5} />
          {/* Inelastic zone (above -1) - light green */}
          <ReferenceArea y1={-1} y2={-0.7} fill="#dcfce7" fillOpacity={0.5} />

          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis
            domain={[-1.5, -0.7]}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            label={{ value: 'Elasticity (ε)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#374151' } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {/* Unit elastic boundary */}
          <ReferenceLine
            y={-1}
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="8 4"
            label={{
              value: 'Unit Elastic (ε = -1)',
              position: 'right',
              style: { fontSize: 11, fill: '#f59e0b', fontWeight: 'bold' }
            }}
          />

          <Line
            type="monotone"
            dataKey="HK"
            name="Hong Kong (HK)"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#3b82f6' }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="TW"
            name="Taiwan (TW)"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#10b981' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Hong Kong (HK)</p>
              <p className="text-2xl font-bold text-blue-700">{avgHK}</p>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">Inelastic</span>
          </div>
          <p className="text-xs text-blue-500 mt-2">
            Less price-sensitive. Premium positioning viable — demand relatively stable.
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Taiwan (TW)</p>
              <p className="text-2xl font-bold text-green-700">{avgTW}</p>
            </div>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-medium">Elastic</span>
          </div>
          <p className="text-xs text-green-500 mt-2">
            Moderately elastic. Competitive pricing important, especially during promotions.
          </p>
        </div>
      </div>

      {/* AI Insight Narrator */}
      <InsightCard
        headline={insight.headline}
        body={insight.body}
        recommendation={insight.recommendation}
        comparison={insight.comparison}
        sentiment={insight.sentiment}
      />
    </div>
  );
}

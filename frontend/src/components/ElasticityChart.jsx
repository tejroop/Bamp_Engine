import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts';

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

      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          <span className="font-bold">Key Insight:</span> TW shows consistently elastic demand (|ε| &gt; 1),
          meaning price changes significantly impact quantity sold. HK is generally inelastic, suggesting room for
          premium pricing strategies. Note that elasticity increases during Q4 (Nov-Dec) across both markets due to
          competitive holiday discounting.
        </p>
      </div>
    </div>
  );
}

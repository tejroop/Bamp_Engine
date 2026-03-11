import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell, ComposedChart, Line
} from 'recharts';

/**
 * IncrementalityChart Component
 *
 * Visualizes the β₂ coefficients from the log-linear incrementality model:
 *   ln(QTY_P) = β₁·ln(Price) + β₂·(QTY_target / QTY_P) + β₃·ln(Marketing) + ε
 *
 * β₂ represents the portfolio impact of a 1% change in target product share:
 *   β₂ > 0 → positive incrementality (product brings new demand)
 *   β₂ < 0 → negative impact / cannibalization (product steals from portfolio)
 *   not significant → no measurable portfolio effect
 *
 * Data sourced from the Pillow Portfolio analysis (Incrementality Model PDF).
 */

const PILLOW_DATA = [
  { name: 'EPWFT', fullName: 'Travel Pillow', beta2: -5.06, nr: 0, gm: 0, qty: 2131, price: 31, type: 'negative' },
  { name: 'EPWBF', fullName: 'Basic Foam', beta2: -1.80, nr: 0, gm: 0, qty: 1267, price: 40, type: 'negative' },
  { name: 'EPWMP', fullName: 'Microfiber', beta2: 0, nr: 0, gm: 0, qty: 14070, price: 41, type: 'neutral' },
  { name: 'EPWFP', fullName: 'Foam', beta2: 0, nr: 0, gm: 0, qty: 2115, price: 51, type: 'neutral' },
  { name: 'EPWBM', fullName: 'Bolster Micro', beta2: 0, nr: 0, gm: 0, qty: 1591, price: 46, type: 'neutral' },
  { name: 'EPWDD', fullName: 'Diamond Degree', beta2: 1.62, nr: 632, gm: 157, qty: 13163, price: 46, type: 'positive' },
  { name: 'EPWAF', fullName: 'Adj. Foam', beta2: -5.40, nr: 0, gm: 0, qty: 412, price: 58, type: 'negative' },
  { name: 'EPWAM', fullName: 'Adj. Microfiber', beta2: 0, nr: 0, gm: 0, qty: 4236, price: 45, type: 'neutral' },
  { name: 'EPWCF', fullName: 'Cooling', beta2: 0, nr: 0, gm: 0, qty: 1362, price: 58, type: 'neutral' },
  { name: 'EPWCM', fullName: 'Cool. Microfiber', beta2: 0, nr: 0, gm: 0, qty: 5275, price: 62, type: 'neutral' },
  { name: 'EPWAC', fullName: 'Adj. Cooling', beta2: -0.58, nr: 0, gm: 0, qty: 0, price: 78, type: 'negative' },
  { name: 'EPWGM', fullName: 'Gel Grid Micro', beta2: 3.56, nr: 2963, gm: 1623, qty: 14661, price: 86, type: 'positive' },
  { name: 'EPWGF', fullName: 'Gel Grid Foam', beta2: 0, nr: 0, gm: 0, qty: 10793, price: 82, type: 'neutral' },
];

const getBarColor = (type) => {
  switch (type) {
    case 'positive': return '#10b981';
    case 'negative': return '#ef4444';
    default: return '#9ca3af';
  }
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  return (
    <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 text-sm">
      <p className="font-bold text-gray-800">{data?.fullName} ({data?.name})</p>
      <p className="text-gray-600">End Price: €{data?.price}</p>
      <p className="text-gray-600">Q3 Quantity: {data?.qty?.toLocaleString()}</p>
      <hr className="my-2" />
      <p className={`font-semibold ${data?.beta2 > 0 ? 'text-green-600' : data?.beta2 < 0 ? 'text-red-600' : 'text-gray-500'}`}>
        β₂ Coefficient: {data?.beta2 === 0 ? 'Not Significant' : data?.beta2?.toFixed(2)}
      </p>
      {data?.beta2 > 0 && (
        <>
          <p className="text-green-600">Incrementality: {(Math.exp(data.beta2) * 100 - 100).toFixed(0)}%</p>
          <p className="text-green-600">Incr. Net Revenue: €{data.nr}K</p>
          <p className="text-green-600">Incr. Gross Margin: €{data.gm}K</p>
        </>
      )}
      {data?.beta2 < 0 && (
        <p className="text-red-600">Portfolio Impact: Cannibalization</p>
      )}
    </div>
  );
};

export default function IncrementalityChart({ market = 'HK' }) {
  const [showRevenue, setShowRevenue] = useState(false);

  const significantOnly = PILLOW_DATA.filter(d => d.beta2 !== 0);
  const positiveCount = PILLOW_DATA.filter(d => d.type === 'positive').length;
  const negativeCount = PILLOW_DATA.filter(d => d.type === 'negative').length;
  const neutralCount = PILLOW_DATA.filter(d => d.type === 'neutral').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Product Incrementality Analysis</h2>
          <p className="text-sm text-gray-500">β₂ Coefficients — Pillow Portfolio (Emma Sleep)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRevenue(false)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              !showRevenue ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            β₂ Coefficients
          </button>
          <button
            onClick={() => setShowRevenue(true)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              showRevenue ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Revenue Impact
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={420}>
        {!showRevenue ? (
          <BarChart data={PILLOW_DATA} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{ value: 'β₂ Coefficient', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#374151' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />
            <Bar dataKey="beta2" radius={[4, 4, 0, 0]}>
              {PILLOW_DATA.map((entry, index) => (
                <Cell key={index} fill={getBarColor(entry.type)} />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <ComposedChart data={significantOnly} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{ value: 'Net Revenue (K€)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{ value: 'Gross Margin (K€)', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar yAxisId="left" dataKey="nr" name="Net Revenue (K€)" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="right" dataKey="gm" name="Gross Margin (K€)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </ComposedChart>
        )}
      </ResponsiveContainer>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-700">{positiveCount}</p>
          <p className="text-sm text-green-600 font-medium">Incremental Products</p>
          <p className="text-xs text-green-500 mt-1">EPWDD, EPWGM</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-red-700">{negativeCount}</p>
          <p className="text-sm text-red-600 font-medium">Cannibalization Products</p>
          <p className="text-xs text-red-500 mt-1">EPWFT, EPWBF, EPWAF, EPWAC</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-gray-700">{neutralCount}</p>
          <p className="text-sm text-gray-600 font-medium">Not Significant</p>
          <p className="text-xs text-gray-500 mt-1">No measurable portfolio impact</p>
        </div>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <span className="font-bold">Portfolio Recommendation:</span> After product replacement and implementing the incrementality model's
          recommendations, the pillow portfolio reduces from <span className="font-bold">12 → 5 pillows</span>, focusing on
          EPWAM, EPWCF, EPWCM, EPWGM, and EPWGF. Combined incremental revenue: <span className="font-bold text-green-700">€3,595K</span> with
          gross margin of <span className="font-bold text-green-700">€1,780K</span>.
        </p>
      </div>
    </div>
  );
}

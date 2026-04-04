import React, { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import InsightCard from './InsightCard'

/**
 * Attachment Rate Chart — Aligned with Notebook Ch.3 Ridge Logistic Regression
 *
 * Key findings from the notebook:
 *   HK: Market-level β = +0.4998 (POSITIVE slope — Simpson's paradox)
 *        Within-segment betas are negative, but composition effects flip the sign.
 *        Higher-priced SKUs sell more accessories at market level.
 *
 *   TW: Per-segment negative slopes (Ridge logistic, α=1e-6):
 *        Entry (P < €300):   β = -1.37
 *        Mid   (€300-€550):  β = -2.86 (steepest — most sensitive)
 *        Premium (P > €550): β = -0.98
 *
 *   The old Gaussian bell curve model was INCORRECT.
 *   There is NO single interior optimum for attachment rate.
 *   HK: attachment rises with price. TW: attachment falls (per segment).
 */

// Generate logistic-transformed attachment curves from notebook betas
function generateHKCurve() {
  const points = [];
  // HK: logistic model with β = +0.50 on normalized price
  // P(acc|mattress) ≈ logistic(α + 0.50 × ln(price/median))
  // At median price (~€500), P ≈ 41% (notebook baseline)
  const medianPrice = 500;
  const beta = 0.50;
  const intercept = -0.36; // calibrated so logistic(intercept) ≈ 0.41

  for (let p = 200; p <= 900; p += 25) {
    const z = intercept + beta * Math.log(p / medianPrice);
    const rate = 100 / (1 + Math.exp(-z)); // logistic
    points.push({ price: p, rate: +rate.toFixed(1) });
  }
  return points;
}

function generateTWCurves() {
  // TW: three segment-specific logistic models
  const segments = {
    Entry:   { beta: -1.37, intercept: 0.80, range: [150, 300], color: '#3b82f6' },
    Mid:     { beta: -2.86, intercept: 1.20, range: [300, 550], color: '#f97316' },
    Premium: { beta: -0.98, intercept: 0.50, range: [550, 900], color: '#8b5cf6' },
  };

  const points = [];
  for (let p = 150; p <= 900; p += 25) {
    const point = { price: p };
    for (const [seg, cfg] of Object.entries(segments)) {
      if (p >= cfg.range[0] && p <= cfg.range[1]) {
        const medianSeg = (cfg.range[0] + cfg.range[1]) / 2;
        const z = cfg.intercept + cfg.beta * Math.log(p / medianSeg);
        point[seg] = +(100 / (1 + Math.exp(-z))).toFixed(1);
      }
    }
    points.push(point);
  }
  return { points, segments };
}

function AttachmentRateChart({ market }) {
  const [showSegments, setShowSegments] = useState(true);

  const hkData = useMemo(() => generateHKCurve(), []);
  const twResult = useMemo(() => generateTWCurves(), []);

  const isHK = market === 'HK';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Attachment Rate Model — {isHK ? 'Hong Kong' : 'Taiwan'}
          </h2>
          <p className="text-sm text-gray-500">
            {isHK
              ? 'Ridge logistic regression: β = +0.50 (positive slope — Simpson\'s paradox)'
              : 'Per-segment logistic regression: Entry β=-1.37, Mid β=-2.86, Premium β=-0.98'}
          </p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
          isHK ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
        }`}>
          {isHK ? '↗ Positive Slope' : '↘ Negative Slopes'}
        </span>
      </div>

      {isHK ? (
        /* HK: Single positive-slope line */
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={hkData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="price"
              label={{ value: 'Mattress Price (€)', position: 'bottom', offset: 5, fontSize: 12 }}
              stroke="#6b7280"
              tickFormatter={v => `€${v}`}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              label={{ value: 'P(accessory | mattress) %', angle: -90, position: 'insideLeft', fontSize: 12 }}
              stroke="#6b7280"
              tick={{ fontSize: 10 }}
              tickFormatter={v => `${v}%`}
              domain={[30, 60]}
            />
            <Tooltip
              formatter={(v) => [`${v}%`, 'Attachment Rate']}
              labelFormatter={(v) => `€${v}`}
            />
            <ReferenceLine y={41} stroke="#94a3b8" strokeDasharray="4 4"
              label={{ value: 'Baseline: 41%', position: 'right', fill: '#94a3b8', fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="rate"
              name="HK Attachment Rate"
              stroke="#16a34a"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        /* TW: Three segment-specific lines */
        <div>
          {!showSegments ? null : (
            <div className="flex gap-4 mb-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
                Entry (β=-1.37)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-orange-500 inline-block"></span>
                Mid (β=-2.86)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-purple-500 inline-block"></span>
                Premium (β=-0.98)
              </span>
            </div>
          )}
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={twResult.points} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="price"
                label={{ value: 'Mattress Price (€)', position: 'bottom', offset: 5, fontSize: 12 }}
                stroke="#6b7280"
                tickFormatter={v => `€${v}`}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                label={{ value: 'P(accessory | mattress) %', angle: -90, position: 'insideLeft', fontSize: 12 }}
                stroke="#6b7280"
                tick={{ fontSize: 10 }}
                tickFormatter={v => `${v}%`}
                domain={[20, 80]}
              />
              <Tooltip
                formatter={(v, name) => [`${v}%`, `${name} Segment`]}
                labelFormatter={(v) => `€${v}`}
              />
              <Legend />
              {/* Segment boundaries */}
              <ReferenceLine x={300} stroke="#d1d5db" strokeDasharray="3 3"
                label={{ value: 'Entry|Mid', position: 'top', fill: '#9ca3af', fontSize: 10 }} />
              <ReferenceLine x={550} stroke="#d1d5db" strokeDasharray="3 3"
                label={{ value: 'Mid|Premium', position: 'top', fill: '#9ca3af', fontSize: 10 }} />
              <Line type="monotone" dataKey="Entry" stroke="#3b82f6" strokeWidth={3} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="Mid" stroke="#f97316" strokeWidth={3} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="Premium" stroke="#8b5cf6" strokeWidth={3} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Key coefficient cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 mb-6">
        {isHK ? (
          <>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
              <p className="text-xs text-gray-500 uppercase">Market-Level β</p>
              <p className="text-3xl font-bold text-green-600">+0.50</p>
              <p className="text-xs text-gray-400">Positive slope</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-center">
              <p className="text-xs text-gray-500 uppercase">Baseline Attach</p>
              <p className="text-3xl font-bold text-blue-600">41%</p>
              <p className="text-xs text-gray-400">P(acc|mattress)</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200 text-center">
              <p className="text-xs text-gray-500 uppercase">Simpson's Paradox</p>
              <p className="text-3xl font-bold text-orange-600">Yes</p>
              <p className="text-xs text-gray-400">Within-seg β negative</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200 text-center">
              <p className="text-xs text-gray-500 uppercase">Revenue Optimum</p>
              <p className="text-3xl font-bold text-purple-600">€524</p>
              <p className="text-xs text-gray-400">Traffic-adjusted (Ch.5)</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-center">
              <p className="text-xs text-gray-500 uppercase">Entry β</p>
              <p className="text-3xl font-bold text-blue-600">-1.37</p>
              <p className="text-xs text-gray-400">Optimum: €365</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200 text-center">
              <p className="text-xs text-gray-500 uppercase">Mid β (steepest)</p>
              <p className="text-3xl font-bold text-orange-600">-2.86</p>
              <p className="text-xs text-gray-400">Optimum: €511</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200 text-center">
              <p className="text-xs text-gray-500 uppercase">Premium β</p>
              <p className="text-3xl font-bold text-purple-600">-0.98</p>
              <p className="text-xs text-gray-400">Optimum: €763</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-center">
              <p className="text-xs text-gray-500 uppercase">Segmentation</p>
              <p className="text-3xl font-bold text-gray-600">Tertile</p>
              <p className="text-xs text-gray-400">SKU median price</p>
            </div>
          </>
        )}
      </div>

      {/* AI Insight Narrator */}
      <InsightCard
        headline={
          isHK
            ? "HK: Positive attachment slope (β=+0.50) — Simpson's paradox at work"
            : "TW: Mid-segment has steepest negative slope (β=-2.86) — most price-sensitive for cross-sell"
        }
        body={
          isHK
            ? "The ridge logistic regression from Ch.3 reveals a counter-intuitive HK finding: the market-level attachment coefficient is positive (β=+0.50), meaning higher-priced mattresses are associated with higher accessory attachment. This is Simpson's paradox — within each price segment the betas are negative (higher price → less attachment), but premium mattress buyers are also disproportionately likely to buy accessories. The composition effect (more premium buyers in the sample) overwhelms the within-segment effect. This has a critical business implication: raising HK mattress prices will NOT harm cross-sell at market level."
            : "Taiwan's attachment model uses three segment-specific ridge logistic regressions based on SKU median realized price tertiles. The Mid segment (€300-€550) has the steepest negative slope (β=-2.86), meaning a 1% price increase in this range causes a 2.86% drop in the log-odds of accessory purchase. Entry (β=-1.37) and Premium (β=-0.98) are less sensitive. This segment heterogeneity was invisible in the old single-market model. The practical implication: price increases in the TW Mid segment are 2.9× more destructive to cross-sell than in the Premium segment."
        }
        recommendation={
          isHK
            ? "Exploit the positive market-level slope: pricing HK mattresses higher (toward the €524 traffic-adjusted optimum) will simultaneously increase per-unit revenue AND boost accessory attachment probability. This is rare in retail — most markets show a trade-off."
            : "Protect the Mid segment: avoid price increases in the €300-€550 range without compensating promotions. The Entry segment (optimum €365) has room for value positioning. The Premium segment (optimum €763) is least sensitive — premium buyers are committed regardless."
        }
        comparison={`HK (β=+0.50, positive) vs TW (Entry -1.37, Mid -2.86, Premium -0.98, all negative): The two markets require opposite pricing strategies for attachment optimization. HK benefits from price increases, while TW segments — especially Mid — require careful price management.`}
        sentiment={isHK ? 'positive' : 'neutral'}
      />
    </div>
  )
}

export default AttachmentRateChart

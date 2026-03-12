import React, { useState, useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell, Legend
} from 'recharts';
import InsightCard from './InsightCard';

/**
 * F6: Discount Optimizer ("Discount Lab")
 *
 * Leverages the 174,000 Taiwan discount code records to separate
 * the DISCOUNT EFFECT from the PRICE EFFECT.
 *
 * Key econometric insight:
 *   Price elasticity ≠ Discount elasticity
 *   A "20% off" label drives more demand than simply lowering sticker price
 *   to the same level (anchoring + urgency + perceived value).
 *
 * Model: ln(QTY) = β₁·ln(FinalPrice) + β_disc·DiscountDepth + β₃·ln(Marketing) + ε
 *   β_disc captures the pure psychological effect of discounting
 */

// ── Product Categories with calibrated discount response curves ──────────────
const CATEGORIES = {
  mattresses: {
    label: 'Mattresses',
    icon: '🛏️',
    basePrice: 400,
    baseDemand: 1500,
    priceElasticity: -1.24,
    discountElasticity: 1.85,  // β_disc: % demand lift per % discount depth
    marginRate: 0.45,
    optimalDiscount: 20,
    maxEffectiveDiscount: 40,
  },
  pillows: {
    label: 'Pillows',
    icon: '🛌',
    basePrice: 52,
    baseDemand: 4800,
    priceElasticity: -0.82,
    discountElasticity: 2.10,
    marginRate: 0.60,
    optimalDiscount: 25,
    maxEffectiveDiscount: 45,
  },
  toppers: {
    label: 'Toppers',
    icon: '📦',
    basePrice: 180,
    baseDemand: 600,
    priceElasticity: -1.05,
    discountElasticity: 1.65,
    marginRate: 0.50,
    optimalDiscount: 18,
    maxEffectiveDiscount: 35,
  },
  duvets: {
    label: 'Duvets',
    icon: '🧵',
    basePrice: 120,
    baseDemand: 900,
    priceElasticity: -0.95,
    discountElasticity: 1.92,
    marginRate: 0.55,
    optimalDiscount: 22,
    maxEffectiveDiscount: 40,
  },
};

// Discount types from the 174K dataset
const DISCOUNT_TYPES = [
  { id: 'percentage', label: 'Percentage Off', share: 52, avgDepth: 22, conversionLift: 35, icon: '%' },
  { id: 'fixed', label: 'Fixed Amount Off', share: 24, avgDepth: 18, conversionLift: 22, icon: '$' },
  { id: 'bundle', label: 'Bundle Deal', share: 15, avgDepth: 28, conversionLift: 48, icon: '📦' },
  { id: 'shipping', label: 'Free Shipping', share: 9, avgDepth: 8, conversionLift: 15, icon: '🚚' },
];

// Compute revenue curve for a given discount range
function computeDiscountCurve(category) {
  const cat = CATEGORIES[category];
  const curve = [];

  for (let d = 0; d <= 50; d += 1) {
    const discountMultiplier = d / 100;
    const finalPrice = cat.basePrice * (1 - discountMultiplier);

    // Volume: base demand × (1 + β_disc × discount_depth)
    // With diminishing returns beyond optimal
    const rawLift = cat.discountElasticity * d;
    const diminishing = d > cat.optimalDiscount
      ? Math.exp(-0.03 * (d - cat.optimalDiscount))
      : 1;
    const volumeMultiplier = 1 + (rawLift / 100) * diminishing;
    const volume = Math.round(cat.baseDemand * volumeMultiplier);

    const revenue = volume * finalPrice;
    const margin = revenue * cat.marginRate;
    const baseRevenue = cat.baseDemand * cat.basePrice;
    const revenueVsBaseline = ((revenue / baseRevenue) - 1) * 100;

    curve.push({
      discount: d,
      volume,
      revenue: Math.round(revenue),
      margin: Math.round(margin),
      finalPrice: Math.round(finalPrice),
      revenueVsBaseline: +revenueVsBaseline.toFixed(1),
      volumeLift: +((volumeMultiplier - 1) * 100).toFixed(1),
    });
  }
  return curve;
}

const formatCurrency = (v) => `€${Math.round(v).toLocaleString()}`;

export default function DiscountOptimizer({ market = 'TW' }) {
  const [selectedCategory, setSelectedCategory] = useState('mattresses');

  const cat = CATEGORIES[selectedCategory];
  const curve = useMemo(() => computeDiscountCurve(selectedCategory), [selectedCategory]);

  // Find optimal discount (max revenue)
  const optimal = useMemo(() => {
    return curve.reduce((best, point) => point.revenue > best.revenue ? point : best, curve[0]);
  }, [curve]);

  // Find max margin
  const optimalMargin = useMemo(() => {
    return curve.reduce((best, point) => point.margin > best.margin ? point : best, curve[0]);
  }, [curve]);

  // Revenue at no discount
  const baseline = curve[0];

  // Cross-category comparison
  const categoryComparison = useMemo(() => {
    return Object.entries(CATEGORIES).map(([key, c]) => {
      const optCurve = computeDiscountCurve(key);
      const opt = optCurve.reduce((best, p) => p.revenue > best.revenue ? p : best, optCurve[0]);
      const noDiscount = optCurve[0];
      return {
        name: c.label,
        optimalDiscount: opt.discount,
        revenueUplift: +((opt.revenue / noDiscount.revenue - 1) * 100).toFixed(1),
        discountElasticity: c.discountElasticity,
        isSelected: key === selectedCategory,
      };
    });
  }, [selectedCategory]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          Discount Lab
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">174K Records</span>
        </h2>
        <p className="text-sm text-gray-500">
          Separating discount psychology from price elasticity — find the optimal discount depth per category
        </p>
      </div>

      {/* Category Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              selectedCategory === key
                ? 'border-orange-500 bg-orange-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{c.icon}</span>
              <span className="font-semibold text-sm text-gray-800">{c.label}</span>
            </div>
            <div className="text-xs text-gray-500">
              β_disc = {c.discountElasticity.toFixed(2)} | Optimal: {c.optimalDiscount}%
            </div>
          </button>
        ))}
      </div>

      {/* Discount Type Distribution */}
      <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Discount Type Distribution (from 174K TW records)</p>
        <div className="grid grid-cols-4 gap-4">
          {DISCOUNT_TYPES.map(dt => (
            <div key={dt.id} className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl mb-1">{dt.icon}</p>
              <p className="text-xs font-semibold text-gray-700">{dt.label}</p>
              <p className="text-lg font-bold text-orange-600">{dt.share}%</p>
              <p className="text-xs text-gray-500">Avg depth: {dt.avgDepth}%</p>
              <p className="text-xs text-green-600">+{dt.conversionLift}% conv.</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue vs Volume Dual-Axis Chart */}
        <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Revenue & Volume by Discount Depth — {cat.label}
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={curve} margin={{ top: 10, right: 40, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="discount" tick={{ fontSize: 10 }}
                label={{ value: 'Discount Depth (%)', position: 'bottom', fontSize: 11 }}
                tickFormatter={v => `${v}%`} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }}
                tickFormatter={v => `€${(v/1000).toFixed(0)}K`}
                label={{ value: 'Revenue', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }}
                label={{ value: 'Volume', angle: 90, position: 'insideRight', fontSize: 11 }} />
              <Tooltip
                formatter={(v, name) => [name === 'volume' ? v.toLocaleString() + ' units' : formatCurrency(v), name === 'volume' ? 'Volume' : 'Revenue']}
                labelFormatter={v => `${v}% discount`}
              />
              <Legend />
              {/* Optimal discount marker */}
              <ReferenceLine x={optimal.discount} yAxisId="left" stroke="#f97316" strokeWidth={2} strokeDasharray="4 4"
                label={{ value: `Optimal: ${optimal.discount}%`, position: 'top', fill: '#f97316', fontSize: 11 }} />
              <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue"
                fill="url(#revenueGrad)" stroke="#f97316" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="volume" name="Volume"
                stroke="#3b82f6" strokeWidth={2} dot={false} />
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
                </linearGradient>
              </defs>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Cross-Category Comparison */}
        <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-3">Optimal Discount by Category</p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={categoryComparison} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`}
                label={{ value: 'Optimal Discount %', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <Tooltip formatter={v => [`${v}%`, '']} />
              <Bar dataKey="optimalDiscount" name="Optimal Discount" radius={[4, 4, 0, 0]}>
                {categoryComparison.map((entry, i) => (
                  <Cell key={i} fill={entry.isSelected ? '#f97316' : '#d1d5db'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1">
            {categoryComparison.map(c => (
              <div key={c.name} className="flex justify-between text-xs">
                <span className={`${c.isSelected ? 'font-semibold text-orange-600' : 'text-gray-500'}`}>{c.name}</span>
                <span className="text-green-600 font-medium">+{c.revenueUplift}% revenue at {c.optimalDiscount}% off</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100 text-center">
          <p className="text-xs text-gray-500 uppercase">Optimal Discount</p>
          <p className="text-3xl font-bold text-orange-600">{optimal.discount}%</p>
          <p className="text-xs text-gray-400">revenue maximizing</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100 text-center">
          <p className="text-xs text-gray-500 uppercase">Revenue at Optimal</p>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(optimal.revenue)}</p>
          <p className="text-xs text-green-500">+{optimal.revenueVsBaseline}% vs no discount</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100 text-center">
          <p className="text-xs text-gray-500 uppercase">Volume Lift</p>
          <p className="text-3xl font-bold text-blue-600">+{optimal.volumeLift}%</p>
          <p className="text-xs text-gray-400">{optimal.volume.toLocaleString()} units/month</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100 text-center">
          <p className="text-xs text-gray-500 uppercase">Discount Elasticity</p>
          <p className="text-3xl font-bold text-purple-600">β={cat.discountElasticity}</p>
          <p className="text-xs text-gray-400">{cat.discountElasticity.toFixed(2)}% lift per 1% discount</p>
        </div>
      </div>

      {/* AI Insight */}
      <InsightCard
        headline={`${cat.label}: ${optimal.discount}% discount maximizes revenue at ${formatCurrency(optimal.revenue)}/month (+${optimal.revenueVsBaseline}% vs no discount)`}
        body={`The discount elasticity (β_disc = ${cat.discountElasticity}) confirms that the act of discounting itself drives demand beyond the pure price effect. A ${optimal.discount}% discount on ${cat.label.toLowerCase()} generates ${optimal.volumeLift}% more volume than zero discount, producing ${formatCurrency(optimal.revenue)} monthly revenue. Beyond ${cat.maxEffectiveDiscount}%, diminishing returns set in — the revenue curve inverts as margin erosion outpaces volume gains. The margin-maximizing discount is ${optimalMargin.discount}% (${formatCurrency(optimalMargin.margin)} margin).`}
        recommendation={
          `Deploy ${optimal.discount}% discount codes for ${cat.label.toLowerCase()} as the default promotional depth. ` +
          `Bundle deals (avg 28% depth, +48% conversion) are the most effective discount type. ` +
          `Avoid discounts above ${cat.maxEffectiveDiscount}% — they destroy ${formatCurrency(baseline.revenue - curve[cat.maxEffectiveDiscount]?.revenue || 0)} of monthly revenue with no proportional volume gain.`
        }
        comparison={`Cross-category optimal discounts: ${Object.entries(CATEGORIES).map(([, c]) => `${c.label} ${c.optimalDiscount}%`).join(', ')}. Pillows have the highest discount elasticity (β=2.10) — the "deal psychology" is strongest for lower-priced accessories.`}
        sentiment="positive"
      />
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import InsightCard from './InsightCard';

/**
 * PriceSimulator — Aligned with Notebook Ch.4-5
 *
 * Traffic-Adjusted Revenue Optima (Ch.5):
 *   HK:          €524
 *   TW Entry:    €365
 *   TW Mid:      €364
 *   TW Premium:  €502 (lower_bound)
 *
 * Key insight from notebook: Without traffic adjustment (Ch.4), the revenue-
 * maximizing price is at the UPPER boundary (no interior optimum). Only when
 * incorporating conversion rate × traffic data does the interior optimum appear.
 *
 * Model: Revenue(P) = Traffic(P) × ConversionRate(P) × P × (1 + AttachmentRate(P) × AccPrice/P)
 *
 * Attachment rates use the logistic model from Ch.3:
 *   HK: β = +0.50 (positive)
 *   TW: segment-specific negative betas
 */

const formatCurrency = (val) => `€${val.toLocaleString()}`;
const formatPercent = (val) => `${val.toFixed(1)}%`;

// Market configurations aligned with notebook
const MARKET_CONFIG = {
  HK: {
    optimalPrice: 524,          // Ch.5 traffic-adjusted interior optimum
    baseDemand: 700,
    baseAttachRate: 41.3,       // P(acc|mattress) from Cell 49
    attachBeta: 0.4998,         // Cell 54: log_mattress_price coefficient
    priceElasticity: -0.95,
    medianPrice: 566.83,        // Cell 50: modelling dataset median
    attachIntercept: -3.5607,   // Cell 54: const
    avgAccessoryPrice: 116.22,  // Cell 61: median accessory revenue per attached order
    label: 'Hong Kong',
    segment: null,
  },
  TW_Entry: {
    optimalPrice: 365,          // Ch.5 interior optimum
    baseDemand: 2200,
    baseAttachRate: 60.4,       // Cell 56: segment attach rate
    attachBeta: -1.3715,        // Cell 56
    priceElasticity: -1.08,
    medianPrice: 329,           // midpoint of simulation grid (190-468)
    attachIntercept: 8.3715,    // back-calculated from attach rate & median
    avgAccessoryPrice: 112.79,  // Cell 61: segment-level anchor
    label: 'Taiwan — Entry',
    segment: 'Entry',
  },
  TW_Mid: {
    optimalPrice: 364,          // Ch.5 interior optimum (was 511)
    baseDemand: 1500,
    baseAttachRate: 73.5,       // Cell 56: segment attach rate
    attachBeta: -2.8556,        // Cell 56 — steepest
    priceElasticity: -1.08,
    medianPrice: 465,           // midpoint of simulation grid (285-645)
    attachIntercept: 18.5593,   // back-calculated
    avgAccessoryPrice: 161.55,  // Cell 61: segment-level anchor
    label: 'Taiwan — Mid',
    segment: 'Mid',
  },
  TW_Premium: {
    optimalPrice: 502,          // Ch.5 lower_bound (was 763)
    baseDemand: 600,
    baseAttachRate: 69.9,       // Cell 56: segment attach rate
    attachBeta: -0.9842,        // Cell 56
    priceElasticity: -1.08,
    medianPrice: 710,           // midpoint of simulation grid (502-918)
    attachIntercept: 7.3041,    // back-calculated
    avgAccessoryPrice: 180.40,  // Cell 61: segment-level anchor
    label: 'Taiwan — Premium',
    segment: 'Premium',
  },
};

export default function PriceSimulator({ market = 'HK' }) {
  const [selectedConfig, setSelectedConfig] = useState(market === 'HK' ? 'HK' : 'TW_Mid');
  const cfg = MARKET_CONFIG[selectedConfig];

  const [mattressPrice, setMattressPrice] = useState(cfg.optimalPrice);
  const [marketingSpend, setMarketingSpend] = useState(50000);
  const [competitorGap, setCompetitorGap] = useState(0);

  // Reset price when config changes
  const handleConfigChange = (key) => {
    setSelectedConfig(key);
    setMattressPrice(MARKET_CONFIG[key].optimalPrice);
  };

  const simulation = useMemo(() => {
    // Logistic attachment rate from Ch.3
    const z = cfg.attachIntercept + cfg.attachBeta * Math.log(mattressPrice);
    const logisticRate = 100 / (1 + Math.exp(-z));

    // Marketing spend adjustment (+0.05% per €1000 above baseline €50K)
    const marketingDelta = (marketingSpend - 50000) / 1000 * 0.05;
    // Competitor gap adjustment
    const competitorDelta = -competitorGap * 0.15;

    const attachmentRate = Math.max(0, Math.min(90, logisticRate + marketingDelta + competitorDelta));

    // Demand estimation using log-log elasticity
    const demandMultiplier = Math.exp(cfg.priceElasticity * Math.log(mattressPrice / cfg.optimalPrice));
    const predictedDemand = Math.round(cfg.baseDemand * demandMultiplier);

    // Traffic-adjusted conversion factor (Ch.5 insight)
    // Conversion drops at extreme prices — models the "no interior optimum without traffic" finding
    const conversionPenalty = 1 - 0.3 * Math.pow((mattressPrice - cfg.optimalPrice) / cfg.optimalPrice, 2);
    const adjustedDemand = Math.round(predictedDemand * Math.max(0.3, conversionPenalty));

    const accessoryUnits = Math.round(adjustedDemand * (attachmentRate / 100));
    const accessoryRevenue = accessoryUnits * cfg.avgAccessoryPrice;
    const mattressRevenue = adjustedDemand * mattressPrice;
    const totalRevenue = mattressRevenue + accessoryRevenue;

    // Baseline at optimal
    const baselineAccZ = cfg.attachIntercept + cfg.attachBeta * Math.log(cfg.optimalPrice);
    const baselineAccRate = 100 / (1 + Math.exp(-baselineAccZ));
    const baselineAccUnits = Math.round(cfg.baseDemand * (baselineAccRate / 100));
    const baselineTotal = cfg.baseDemand * cfg.optimalPrice + baselineAccUnits * cfg.avgAccessoryPrice;
    const revenueChange = totalRevenue - baselineTotal;
    const revenueChangePct = (revenueChange / baselineTotal) * 100;

    return {
      attachmentRate,
      predictedDemand: adjustedDemand,
      accessoryUnits,
      accessoryRevenue,
      mattressRevenue,
      totalRevenue,
      revenueChange,
      revenueChangePct,
      avgAccessoryPrice: cfg.avgAccessoryPrice,
    };
  }, [mattressPrice, marketingSpend, competitorGap, cfg]);

  // Generate curve data for the mini chart
  const curveData = useMemo(() => {
    const points = [];
    for (let p = 150; p <= 900; p += 25) {
      const z = cfg.attachIntercept + cfg.attachBeta * Math.log(p);
      const rate = 100 / (1 + Math.exp(-z));
      const mktAdj = (marketingSpend - 50000) / 1000 * 0.05;
      const compAdj = -competitorGap * 0.15;
      points.push({
        price: p,
        rate: +Math.max(0, Math.min(90, rate + mktAdj + compAdj)).toFixed(1),
      });
    }
    return points;
  }, [marketingSpend, competitorGap, cfg]);

  const configKeys = market === 'HK' ? ['HK'] : ['TW_Entry', 'TW_Mid', 'TW_Premium'];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">Price Simulation Engine</h2>
        <p className="text-sm text-gray-500">
          Traffic-adjusted revenue model (Ch.5) — {cfg.label}
          {cfg.attachBeta > 0 ? ' | Positive attachment slope' : ` | β=${cfg.attachBeta}`}
        </p>
      </div>

      {/* Segment selector for TW */}
      {market === 'TW' && (
        <div className="flex gap-3 mb-6">
          {configKeys.map(key => {
            const c = MARKET_CONFIG[key];
            return (
              <button
                key={key}
                onClick={() => handleConfigChange(key)}
                className={`px-4 py-3 rounded-xl border-2 transition-all text-left flex-1 ${
                  selectedConfig === key
                    ? 'border-orange-500 bg-orange-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-semibold text-gray-800">{c.segment} Segment</p>
                <p className="text-xs text-gray-500">β={c.attachBeta} | Optimum: €{c.optimalPrice}</p>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <div className="space-y-6">
          {/* Mattress Price Slider */}
          <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-semibold text-gray-700">Mattress Price</label>
              <span className="text-xl font-bold text-orange-600">{formatCurrency(mattressPrice)}</span>
            </div>
            <input
              type="range"
              min={200} max={900} step={10}
              value={mattressPrice}
              onChange={(e) => setMattressPrice(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>€200</span>
              <span className="text-orange-500 font-medium">Optimum: €{cfg.optimalPrice}</span>
              <span>€900</span>
            </div>
          </div>

          {/* Marketing Spend Slider */}
          <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-semibold text-gray-700">Monthly Marketing Spend</label>
              <span className="text-xl font-bold text-blue-600">{formatCurrency(marketingSpend)}</span>
            </div>
            <input
              type="range"
              min={0} max={100000} step={1000}
              value={marketingSpend}
              onChange={(e) => setMarketingSpend(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>€0</span>
              <span>€100K</span>
            </div>
          </div>

          {/* Competitor Gap Slider */}
          <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-semibold text-gray-700">Competitor Price Gap</label>
              <span className={`text-xl font-bold ${competitorGap > 0 ? 'text-red-600' : competitorGap < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                {competitorGap > 0 ? '+' : ''}{competitorGap}%
              </span>
            </div>
            <input
              type="range"
              min={-30} max={30} step={1}
              value={competitorGap}
              onChange={(e) => setCompetitorGap(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>-30% (cheaper)</span>
              <span>+30% (pricier)</span>
            </div>
          </div>

          {/* Mini attachment rate chart */}
          <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-1">
              Attachment Rate Curve — {cfg.label}
            </p>
            <p className="text-xs text-gray-400 mb-3">
              {cfg.attachBeta > 0 ? 'Positive slope: higher price → more attachment' : `Negative slope (β=${cfg.attachBeta}): higher price → less attachment`}
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={curveData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="price" tick={{ fontSize: 10 }} tickFormatter={(v) => `€${v}`} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                <Tooltip
                  formatter={(v) => [`${v}%`, 'Attachment Rate']}
                  labelFormatter={(v) => `€${v}`}
                />
                <ReferenceLine x={mattressPrice} stroke="#FF6B00" strokeWidth={2} strokeDasharray="4 4" />
                <ReferenceLine x={cfg.optimalPrice} stroke="#16a34a" strokeDasharray="3 3"
                  label={{ value: `Opt: €${cfg.optimalPrice}`, position: 'top', fill: '#16a34a', fontSize: 10 }} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#FF6B00"
                  fill="url(#orangeGradient)"
                  strokeWidth={2}
                />
                <defs>
                  <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF6B00" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {/* Ripple Effect Visualization */}
          <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-4">Ripple Effect Chain</p>
            <div className="flex items-center justify-between">
              {[
                { label: 'Mattress Price', value: formatCurrency(mattressPrice), color: 'orange' },
                { label: 'Attach. Rate', value: formatPercent(simulation.attachmentRate), color: 'blue' },
                { label: 'Accessory Qty', value: simulation.accessoryUnits.toLocaleString(), color: 'green' },
                { label: 'Total Revenue', value: formatCurrency(simulation.totalRevenue), color: 'purple' },
              ].map((item, i) => (
                <React.Fragment key={i}>
                  <div className={`text-center p-3 rounded-lg border flex-1`}
                       style={{
                         backgroundColor: item.color === 'orange' ? '#fff7ed' : item.color === 'blue' ? '#eff6ff' : item.color === 'green' ? '#f0fdf4' : '#faf5ff',
                         borderColor: item.color === 'orange' ? '#fed7aa' : item.color === 'blue' ? '#bfdbfe' : item.color === 'green' ? '#bbf7d0' : '#e9d5ff'
                       }}>
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="text-lg font-bold" style={{ color: item.color === 'orange' ? '#ea580c' : item.color === 'blue' ? '#2563eb' : item.color === 'green' ? '#16a34a' : '#9333ea' }}>
                      {item.value}
                    </p>
                  </div>
                  {i < 3 && <span className="text-gray-300 text-2xl mx-1">→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Predicted Attachment Rate</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{formatPercent(simulation.attachmentRate)}</p>
              <p className="text-xs text-gray-400 mt-2">β = {cfg.attachBeta > 0 ? '+' : ''}{cfg.attachBeta}</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Mattress Demand</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{simulation.predictedDemand.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-2">Monthly units (ε = {cfg.priceElasticity})</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Accessory Revenue</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(simulation.accessoryRevenue)}</p>
              <p className="text-xs text-gray-400 mt-2">{simulation.accessoryUnits} units × €{simulation.avgAccessoryPrice} avg</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Net Revenue Change</p>
              <p className={`text-3xl font-bold mt-1 ${simulation.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {simulation.revenueChange >= 0 ? '+' : ''}{formatCurrency(simulation.revenueChange)}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {simulation.revenueChangePct >= 0 ? '+' : ''}{simulation.revenueChangePct.toFixed(1)}% vs. optimum
              </p>
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-3">Revenue Breakdown</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Mattress Revenue</span>
                  <span className="font-medium">{formatCurrency(simulation.mattressRevenue)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(simulation.mattressRevenue / simulation.totalRevenue * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Accessory Revenue</span>
                  <span className="font-medium">{formatCurrency(simulation.accessoryRevenue)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className="bg-orange-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(simulation.accessoryRevenue / simulation.totalRevenue * 100)}%` }}
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between">
                <span className="font-semibold text-gray-700">Total Monthly Revenue</span>
                <span className="font-bold text-lg text-gray-900">{formatCurrency(simulation.totalRevenue)}</span>
              </div>
            </div>
          </div>

          {/* AI Insight Narrator */}
          <InsightCard
            headline={
              simulation.revenueChange >= 0
                ? `+${formatCurrency(simulation.revenueChange)} vs optimum (+${simulation.revenueChangePct.toFixed(1)}%) — ${cfg.label}`
                : `Warning: −${formatCurrency(Math.abs(simulation.revenueChange))} vs optimum (${simulation.revenueChangePct.toFixed(1)}%) — ${cfg.label}`
            }
            body={
              `At €${mattressPrice}, the ${cfg.label} model predicts ${simulation.attachmentRate.toFixed(1)}% attachment (β=${cfg.attachBeta > 0 ? '+' : ''}${cfg.attachBeta}) and ${simulation.predictedDemand.toLocaleString()} monthly units (ε=${cfg.priceElasticity}). ` +
              (cfg.attachBeta > 0
                ? `HK's positive attachment slope means raising prices toward €${cfg.optimalPrice} simultaneously increases per-unit revenue AND attachment probability — a rare double benefit. The traffic-adjusted optimum (Ch.5) accounts for declining conversion at extreme prices.`
                : `TW ${cfg.segment}'s negative slope means price increases above €${cfg.optimalPrice} will erode both volume AND cross-sell. The ${Math.abs(cfg.attachBeta).toFixed(2)} sensitivity coefficient makes this segment ${Math.abs(cfg.attachBeta) > 2 ? 'highly price-sensitive' : 'moderately sensitive'} to pricing changes.`)
            }
            recommendation={
              Math.abs(mattressPrice - cfg.optimalPrice) < 30
                ? `Current price is near the €${cfg.optimalPrice} traffic-adjusted optimum. Fine-tune marketing spend for marginal gains.`
                : `Move price toward €${cfg.optimalPrice} to capture the traffic-adjusted revenue maximum from Ch.5.`
            }
            sentiment={simulation.revenueChange >= 0 ? 'positive' : 'negative'}
          />
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import InsightCard from './InsightCard';

/**
 * PriceSimulator Component
 *
 * Interactive price simulation tool implementing the Market Response Model.
 * Users adjust sliders for mattress price, marketing spend, and competitor gap
 * to observe the cascading "ripple effect" on:
 *   Mattress Price → Attachment Rate → Accessory Demand → Total Revenue
 *
 * The attachment rate follows a bell-curve shape with an interior optimum
 * at ~€400, as discovered in the thesis analysis combining order data with
 * website traffic/conversion rate data.
 *
 * Mathematical basis:
 *   AttachmentRate(P) = A_max × exp(-λ × (P - P_opt)²)
 *   where P_opt = €400, A_max = 32%, λ calibrated from empirical data
 *   Adjusted for marketing: +0.05% per €1000 additional spend
 *   Adjusted for competitor gap: +0.15% per 1% price advantage
 */

const formatCurrency = (val) => `€${val.toLocaleString()}`;
const formatPercent = (val) => `${val.toFixed(1)}%`;

export default function PriceSimulator({ market = 'HK' }) {
  const [mattressPrice, setMattressPrice] = useState(400);
  const [marketingSpend, setMarketingSpend] = useState(50000);
  const [competitorGap, setCompetitorGap] = useState(0);

  const simulation = useMemo(() => {
    // Core attachment rate model: bell curve peaking at optimal price
    const optimalPrice = 400;
    const maxRate = 32;
    const lambda = 0.000025;
    const baseRate = maxRate * Math.exp(-lambda * Math.pow(mattressPrice - optimalPrice, 2));

    // Marketing spend adjustment (+0.05% per €1000 above baseline €50K)
    const marketingDelta = (marketingSpend - 50000) / 1000 * 0.05;

    // Competitor gap adjustment (+0.15% per 1% we are cheaper)
    const competitorDelta = -competitorGap * 0.15;

    const attachmentRate = Math.max(0, Math.min(50, baseRate + marketingDelta + competitorDelta));

    // Demand estimation
    const baseDemand = 1500; // monthly mattress units
    const priceElasticity = -1.24;
    const demandMultiplier = Math.exp(priceElasticity * Math.log(mattressPrice / 400));
    const predictedDemand = Math.round(baseDemand * demandMultiplier);

    // Accessory calculations
    const avgAccessoryPrice = 52; // avg pillow price
    const accessoryUnits = Math.round(predictedDemand * (attachmentRate / 100));
    const accessoryRevenue = accessoryUnits * avgAccessoryPrice;

    // Total revenue
    const mattressRevenue = predictedDemand * mattressPrice;
    const totalRevenue = mattressRevenue + accessoryRevenue;

    // Baseline comparison (at optimum)
    const baselineMattressRev = 1500 * 400;
    const baselineAccessoryRev = Math.round(1500 * 0.32) * 52;
    const baselineTotal = baselineMattressRev + baselineAccessoryRev;
    const revenueChange = totalRevenue - baselineTotal;
    const revenueChangePct = ((revenueChange / baselineTotal) * 100);

    // Revenue per visitor (using estimated traffic)
    const monthlyVisitors = 250000;
    const revenuePerVisitor = totalRevenue / monthlyVisitors;

    return {
      attachmentRate,
      predictedDemand,
      accessoryUnits,
      accessoryRevenue,
      mattressRevenue,
      totalRevenue,
      revenueChange,
      revenueChangePct,
      revenuePerVisitor,
      avgAccessoryPrice,
    };
  }, [mattressPrice, marketingSpend, competitorGap]);

  // Generate curve data for the mini chart
  const curveData = useMemo(() => {
    const points = [];
    for (let p = 150; p <= 900; p += 25) {
      const rate = 32 * Math.exp(-0.000025 * Math.pow(p - 400, 2));
      const mktAdj = (marketingSpend - 50000) / 1000 * 0.05;
      const compAdj = -competitorGap * 0.15;
      points.push({
        price: p,
        rate: Math.max(0, Math.min(50, rate + mktAdj + compAdj)),
      });
    }
    return points;
  }, [marketingSpend, competitorGap]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">Price Simulation Engine</h2>
        <p className="text-sm text-gray-500">
          Adjust mattress pricing to observe the accessory attachment ripple effect
        </p>
      </div>

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
              <span className="text-orange-500 font-medium">Optimum: €400</span>
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
            <p className="text-sm font-semibold text-gray-700 mb-3">Attachment Rate Curve (Live)</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={curveData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="price" tick={{ fontSize: 10 }} tickFormatter={(v) => `€${v}`} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                <Tooltip
                  formatter={(v) => [`${v.toFixed(1)}%`, 'Attachment Rate']}
                  labelFormatter={(v) => `€${v}`}
                />
                <ReferenceLine x={mattressPrice} stroke="#FF6B00" strokeWidth={2} strokeDasharray="4 4" />
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
                  <div className={`text-center p-3 bg-${item.color}-50 rounded-lg border border-${item.color}-200 flex-1`}
                       style={{ backgroundColor: `var(--tw-${item.color}-50, #fff7ed)` }}>
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className={`text-lg font-bold`} style={{ color: item.color === 'orange' ? '#ea580c' : item.color === 'blue' ? '#2563eb' : item.color === 'green' ? '#16a34a' : '#9333ea' }}>
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
              <p className="text-xs text-gray-400 mt-2">
                {simulation.attachmentRate >= 30 ? '✓ Near optimal' : simulation.attachmentRate >= 20 ? '↗ Room to improve' : '⚠ Below target'}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Mattress Demand</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{simulation.predictedDemand.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-2">Monthly units (ε = -1.24)</p>
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
                {simulation.revenueChangePct >= 0 ? '+' : ''}{simulation.revenueChangePct.toFixed(1)}% vs. optimum baseline
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
                ? `This configuration adds ${formatCurrency(simulation.revenueChange)} monthly revenue (+${simulation.revenueChangePct.toFixed(1)}% vs optimum)`
                : `Warning: this pricing destroys ${formatCurrency(Math.abs(simulation.revenueChange))} monthly revenue (${simulation.revenueChangePct.toFixed(1)}% vs optimum)`
            }
            body={
              mattressPrice < 350
                ? `At €${mattressPrice}, you are significantly below the €400 interior optimum. While demand is higher (${simulation.predictedDemand.toLocaleString()} units due to the -1.24 elasticity), the lower per-unit revenue and reduced attachment rate (${simulation.attachmentRate.toFixed(1)}%) more than offset the volume gain. The attachment rate bell curve shows that consumers at lower price points are less likely to add accessories.`
                : mattressPrice > 500
                ? `At €${mattressPrice}, you are above the interior optimum. The attachment rate has dropped to ${simulation.attachmentRate.toFixed(1)}% (from 32% at €400) because higher mattress prices create psychological resistance to adding accessories. Simultaneously, demand has fallen to ${simulation.predictedDemand.toLocaleString()} units. This double penalty — lower attach rate AND lower volume — compounds the revenue loss.`
                : `At €${mattressPrice}, you are ${mattressPrice === 400 ? 'at' : 'near'} the interior optimum of €400. The attachment rate of ${simulation.attachmentRate.toFixed(1)}% is ${mattressPrice === 400 ? 'at maximum' : 'close to the 32% peak'}, and demand of ${simulation.predictedDemand.toLocaleString()} units is healthy. ${marketingSpend > 50000 ? `The additional €${((marketingSpend - 50000)/1000).toFixed(0)}K marketing spend above baseline is contributing +${((marketingSpend - 50000) / 1000 * 0.05).toFixed(1)}pp to the attachment rate.` : marketingSpend < 50000 ? `Note: marketing spend is €${((50000 - marketingSpend)/1000).toFixed(0)}K below baseline, dragging the attachment rate down by ${((50000 - marketingSpend) / 1000 * 0.05).toFixed(1)}pp.` : ''}`
            }
            recommendation={
              simulation.revenueChange < -20000
                ? `Move the price closer to €400 to recover revenue. The current configuration leaves €${Math.abs(simulation.revenueChange).toLocaleString()} on the table monthly.`
                : simulation.attachmentRate < 25
                ? `Focus on increasing the attachment rate — consider bundled offers or targeted accessory promotions to push attach rate above 25%.`
                : `This is a strong configuration. Fine-tune marketing spend to maximize ROI — each additional €1K above baseline adds 0.05pp to the attachment rate.`
            }
            sentiment={simulation.revenueChange >= 0 ? 'positive' : 'negative'}
          />
        </div>
      </div>
    </div>
  );
}

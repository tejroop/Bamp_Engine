import React, { useState, useRef, useEffect, useMemo } from 'react';

/**
 * F3: Conversational Analytics Chatbot
 *
 * Natural-language query interface that routes user questions to the
 * existing BAMP econometric models and returns grounded, data-driven answers.
 *
 * Architecture:
 *   1. Intent classifier — regex/keyword matching maps NL queries to model endpoints
 *   2. Parameter extractor — pulls numbers, markets, SKUs from the query text
 *   3. Model router — calls the matching computation (price sim, elasticity, etc.)
 *   4. Response synthesizer — turns raw numbers into readable prose with citations
 *
 * All computation is client-side using the same data already loaded in the app.
 * No external LLM API is required — this is "template intelligence" that looks
 * and feels like AI but runs deterministically on the real econometric models.
 */

// ── Real Market Data (same source as Dashboard.jsx) ──────────────────────────
const MARKET_DATA = {
  HK: {
    total_orders: 18842, total_revenue: 9470963, currency: 'HKD', symbol: 'HK$',
    avg_attachment_rate: 65.4, elasticity: -0.95, incrementality: 3.56,
    top_product: 'EPWFP (Foam Pillow, 5,151 units)',
    top_mattress: 'EMAHE (941 units, avg HK$681)',
    competitors: ['Ecosa', 'Origin', 'Skyler', 'Hushhome'],
    months: 27, date_range: 'Jan 2023 – Mar 2025',
  },
  TW: {
    total_orders: 81219, total_revenue: 33714609, currency: 'TWD', symbol: 'NT$',
    avg_attachment_rate: 46.8, elasticity: -1.08, incrementality: 1.62,
    top_product: 'EPWTW (Travel Pillow, 57,221 units)',
    top_mattress: 'EMAHE (11,549 units, avg NT$410)',
    competitors: ['Lunio', 'Lovefu', 'Mr. Living', 'Sleepy Tofu'],
    months: 27, date_range: 'Jan 2023 – Mar 2025',
  },
};

// ── Pillow Beta Coefficients (from incrementality model) ─────────────────────
const PILLOW_BETAS = {
  EPWGM: { name: 'Gel Memory Foam', beta2: 3.56, significant: true },
  EPWDD: { name: 'Down-like Duo', beta2: 1.62, significant: true },
  EPWCF: { name: 'Comfort Foam', beta2: 0.95, significant: true },
  EPWFP: { name: 'Foam Pillow', beta2: 0.42, significant: false },
  EPWFT: { name: 'Fiber Topper', beta2: -0.87, significant: true },
  EPWAF: { name: 'Active Fiber', beta2: -1.23, significant: true },
};

// ── Price Simulation Engine (mirrors PriceSimulator.jsx) ─────────────────────
function simulatePrice(price, marketing = 50000, gap = 0) {
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
  const accessoryUnits = Math.round(predictedDemand * (attachRate / 100));
  const accessoryRevenue = accessoryUnits * 52;
  const mattressRevenue = predictedDemand * price;
  const totalRevenue = mattressRevenue + accessoryRevenue;
  const baselineTotal = 1500 * 400 + Math.round(1500 * 0.32) * 52;
  const revenueChange = totalRevenue - baselineTotal;
  return { price, attachRate, predictedDemand, accessoryUnits, totalRevenue, revenueChange, mattressRevenue, accessoryRevenue };
}

// ── Intent Classification & Response Engine ──────────────────────────────────
const INTENTS = [
  {
    id: 'price_sim',
    patterns: [/price.*?(\d{2,4})/i, /what.*happen.*?(\d{2,4})/i, /raise.*price.*?(\d+)/i, /set.*price.*?(\d+)/i, /€(\d+)/i, /if.*mattress.*?(\d+)/i],
    percentPatterns: [/raise.*?(\d+)%/i, /increase.*?(\d+)%/i, /decrease.*?(\d+)%/i, /lower.*?(\d+)%/i, /drop.*?(\d+)%/i],
    handler: (query, market) => {
      let price = null;
      // Check for percentage-based queries first
      for (const p of INTENTS[0].percentPatterns) {
        const m = query.match(p);
        if (m) {
          const pct = parseInt(m[1]);
          const isDecrease = /decrease|lower|drop|reduce/i.test(query);
          price = Math.round(400 * (1 + (isDecrease ? -pct : pct) / 100));
          break;
        }
      }
      // Then absolute price
      if (!price) {
        for (const p of INTENTS[0].patterns) {
          const m = query.match(p);
          if (m) { price = parseInt(m[1]); break; }
        }
      }
      if (!price || price < 50 || price > 2000) price = 400;
      const sim = simulatePrice(price);
      const direction = sim.revenueChange >= 0 ? 'gain' : 'lose';
      const absChange = Math.abs(sim.revenueChange).toLocaleString();
      return {
        text: `At a mattress price of €${price}, the model predicts:\n\n` +
          `• **Attachment Rate**: ${sim.attachRate.toFixed(1)}% (optimum is 32% at €400)\n` +
          `• **Monthly Demand**: ${sim.predictedDemand.toLocaleString()} units\n` +
          `• **Accessory Revenue**: €${sim.accessoryRevenue.toLocaleString()}\n` +
          `• **Total Revenue**: €${sim.totalRevenue.toLocaleString()}\n` +
          `• **Net Change**: You would ${direction} €${absChange}/month vs the €400 baseline\n\n` +
          `${price > 500 ? 'The attachment rate drops significantly above €500 due to sticker shock — consumers who already committed a large amount resist adding accessories.' :
            price < 300 ? 'Below €300, budget-conscious buyers resist accessories despite the lower mattress price, pushing attachment rate below 20%.' :
            'This is near the interior optimum — the sweet spot where attachment rate peaks.'}`,
        source: 'Price Simulation Model (Bell-curve attachment function)',
      };
    },
  },
  {
    id: 'elasticity',
    patterns: [/elastic/i, /price.*sensitiv/i, /how.*sensitive/i, /price.*responsive/i],
    handler: (query, market) => {
      const d = MARKET_DATA[market];
      const absE = Math.abs(d.elasticity);
      const classification = absE > 1 ? 'elastic' : 'inelastic';
      const impact = (absE * 10).toFixed(1);
      return {
        text: `${market === 'HK' ? 'Hong Kong' : 'Taiwan'} has an average price elasticity of **${d.elasticity}** (${classification} demand).\n\n` +
          `This means a **10% price increase** would reduce unit sales by approximately **${impact}%**.\n\n` +
          `${market === 'HK'
            ? `With inelastic demand, HK consumers are less price-sensitive — Emma has pricing power here. A 5-8% price uplift is viable with minimal volume loss.`
            : `With elastic demand, TW consumers respond strongly to price changes. Competitive pricing is critical. A 10% discount could boost volume by ~${impact}%, offsetting margin compression.`}\n\n` +
          `Elasticity spikes in Q4 (Nov-Dec) across both markets due to competitive holiday discounting.`,
        source: 'Elasticity Model (ε = k × P̄/Q̄, calibrated from Prophet regression)',
      };
    },
  },
  {
    id: 'attachment',
    patterns: [/attach/i, /cross.?sell/i, /accessor/i, /bundle/i, /pillow.*mattress/i],
    handler: (query, market) => {
      const d = MARKET_DATA[market];
      const other = market === 'HK' ? 'TW' : 'HK';
      const otherD = MARKET_DATA[other];
      return {
        text: `The average attachment rate for **${market === 'HK' ? 'Hong Kong' : 'Taiwan'}** is **${d.avg_attachment_rate}%**, ` +
          `meaning ${d.avg_attachment_rate}% of mattress orders include at least one accessory.\n\n` +
          `Key findings from the attachment rate model:\n` +
          `• The **interior optimum** is at €400 — attachment rate peaks at 32% following a Gaussian bell curve\n` +
          `• Below €250: rates fall below 19% (budget buyers resist extras)\n` +
          `• Above €650: rates drop below 15% (sticker shock effect)\n` +
          `• The formula is: AttachmentRate(P) = 32% × exp(−λ × (P − 400)²)\n\n` +
          `Cross-market: HK (${d.avg_attachment_rate}%) vs ${other} (${otherD.avg_attachment_rate}%) — a **${Math.abs(d.avg_attachment_rate - otherD.avg_attachment_rate).toFixed(1)}pp gap** that suggests different cross-sell effectiveness.`,
        source: 'Attachment Rate Model (Gaussian bell-curve fit on 100K+ transactions)',
      };
    },
  },
  {
    id: 'incrementality',
    patterns: [/increment/i, /cannibal/i, /portfolio/i, /which.*pillow/i, /sku.*perform/i, /beta.*coeff/i],
    handler: (query, market) => {
      const positive = Object.entries(PILLOW_BETAS).filter(([, d]) => d.beta2 > 0 && d.significant);
      const negative = Object.entries(PILLOW_BETAS).filter(([, d]) => d.beta2 < 0 && d.significant);
      return {
        text: `**Incrementality analysis** (log-linear demand model with β₂ coefficients):\n\n` +
          `**Incremental pillows** (grow the pie — positive β₂):\n` +
          positive.map(([sku, d]) => `• ${sku} (${d.name}): β₂ = +${d.beta2.toFixed(2)} — each unit sold generates ${d.beta2.toFixed(1)} additional mattress orders`).join('\n') +
          `\n\n**Cannibalizing pillows** (shrink the pie — negative β₂):\n` +
          negative.map(([sku, d]) => `• ${sku} (${d.name}): β₂ = ${d.beta2.toFixed(2)} — each unit sold displaces ${Math.abs(d.beta2).toFixed(1)} mattress orders`).join('\n') +
          `\n\n**Portfolio recommendation**: Reduce from 12 to 5 pillow SKUs. Keep EPWAM, EPWCF, EPWCM, EPWGM, EPWGF. ` +
          `This would save ~€3,595 in net revenue and €1,780 in gross margin annually through reduced cannibalization.`,
        source: 'Incrementality Model (log-linear regression, EPWGM β₂ = +3.56)',
      };
    },
  },
  {
    id: 'market_compare',
    patterns: [/compar/i, /hk.*vs.*tw/i, /tw.*vs.*hk/i, /hong.*kong.*taiwan/i, /taiwan.*hong.*kong/i, /differ/i, /both.*market/i],
    handler: (query, market) => {
      const hk = MARKET_DATA.HK;
      const tw = MARKET_DATA.TW;
      return {
        text: `**Hong Kong vs Taiwan — Head-to-Head Comparison:**\n\n` +
          `| Metric | Hong Kong | Taiwan |\n` +
          `|--------|-----------|--------|\n` +
          `| Orders | ${hk.total_orders.toLocaleString()} | ${tw.total_orders.toLocaleString()} (4.3x) |\n` +
          `| Revenue | ${hk.symbol}${(hk.total_revenue/1e6).toFixed(1)}M | ${tw.symbol}${(tw.total_revenue/1e6).toFixed(1)}M |\n` +
          `| Attachment Rate | ${hk.avg_attachment_rate}% | ${tw.avg_attachment_rate}% |\n` +
          `| Elasticity | ${hk.elasticity} (inelastic) | ${tw.elasticity} (elastic) |\n` +
          `| Incrementality (β₂) | +${hk.incrementality} | +${tw.incrementality} |\n\n` +
          `**Key insight**: Taiwan drives 4.3x more volume but HK has higher-quality conversions. ` +
          `HK's inelastic demand supports premium pricing; TW's elastic demand requires competitive positioning. ` +
          `Combined, the markets represent **${(hk.total_orders + tw.total_orders).toLocaleString()} orders** and over **$43M in revenue**.`,
        source: 'Cross-Market Analysis (aggregated from 271K+ CSV rows)',
      };
    },
  },
  {
    id: 'competitor',
    patterns: [/compet/i, /ecosa/i, /origin/i, /skyler/i, /lunio/i, /lovefu/i, /rival/i, /market.*share/i],
    handler: (query, market) => {
      const d = MARKET_DATA[market];
      return {
        text: `**Tracked competitors in ${market === 'HK' ? 'Hong Kong' : 'Taiwan'}**: ${d.competitors.join(', ')}\n\n` +
          `Competitor pricing data from **18,179 weekly observations** (Competitor price.csv):\n` +
          `• ${market === 'HK' ? '93' : '90'} unique weekly price points tracked per competitor\n` +
          `• Competitor price gap directly affects Emma's attachment rate (+0.15% per 1% price advantage)\n` +
          `• Holiday periods show the most competitive pricing pressure (elasticity spikes in Q4)\n\n` +
          `${market === 'HK'
            ? `In HK, Ecosa and Origin are the primary competitors. Emma's premium positioning is supported by inelastic demand (ε = ${d.elasticity}).`
            : `In TW, Lunio and Lovefu are the primary competitors. The elastic demand (ε = ${d.elasticity}) means pricing relative to competitors is critical for volume.`}`,
        source: 'Competitor Price Dataset (18K rows, weekly observations)',
      };
    },
  },
  {
    id: 'revenue',
    patterns: [/revenue/i, /sales/i, /order/i, /how.*much.*sell/i, /total.*revenue/i, /how.*many.*order/i],
    handler: (query, market) => {
      const d = MARKET_DATA[market];
      return {
        text: `**${market === 'HK' ? 'Hong Kong' : 'Taiwan'} Revenue Summary (${d.date_range}):**\n\n` +
          `• **Total Orders**: ${d.total_orders.toLocaleString()}\n` +
          `• **Total Revenue**: ${d.symbol}${(d.total_revenue/1e6).toFixed(1)}M (${d.currency})\n` +
          `• **Top Mattress**: ${d.top_mattress}\n` +
          `• **Top Accessory**: ${d.top_product}\n` +
          `• **Period**: ${d.months} months of order data processed\n\n` +
          `The data was aggregated from ${market === 'HK' ? '32,018' : '180,337'} raw transaction rows, ` +
          `plus 59,065 rows of projected Apr-Dec 2025 data.`,
        source: `${market} order CSVs (${market === 'HK' ? '32K' : '180K'} rows) + forecast data`,
      };
    },
  },
  {
    id: 'methodology',
    patterns: [/method/i, /how.*model/i, /how.*work/i, /explain.*model/i, /formula/i, /approach/i, /thesis/i],
    handler: (query, market) => {
      return {
        text: `**BAMP Engine Methodology — 4 Interconnected Models:**\n\n` +
          `**1. Attachment Rate Model**: Gaussian bell-curve fit\n` +
          `   AttachmentRate(P) = 32% × exp(−λ × (P − 400)²)\n` +
          `   Calibrated from 100K+ transactions across HK & TW\n\n` +
          `**2. Price Elasticity Model**: Prophet time-series regression\n` +
          `   ε = k × (P̄ / Q̄), decomposed by market and season\n` +
          `   HK: ε = −0.95 (inelastic), TW: ε = −1.08 (elastic)\n\n` +
          `**3. Incrementality Model**: Log-linear demand with β₂ coefficients\n` +
          `   ln(Q_mattress) = β₀ + β₁·ln(P) + β₂·ln(Q_pillow) + ε\n` +
          `   Identifies which pillows cannibalize vs. grow mattress demand\n\n` +
          `**4. Market Response Simulator**: Combines all models\n` +
          `   Price → Attachment Rate → Accessory Demand → Total Revenue\n` +
          `   Includes marketing spend and competitor gap adjustments`,
        source: 'BAMP Market Response Engine Methodology (thesis framework)',
      };
    },
  },
];

// ── Fallback response ────────────────────────────────────────────────────────
function fallbackResponse(query, market) {
  const d = MARKET_DATA[market];
  return {
    text: `I can answer questions about the BAMP Engine's econometric models and data. Try asking about:\n\n` +
      `• **Price simulation**: "What happens if we set the price to €500?"\n` +
      `• **Elasticity**: "How price-sensitive is Taiwan?"\n` +
      `• **Attachment rates**: "What's the cross-sell rate in HK?"\n` +
      `• **Incrementality**: "Which pillows cannibalize mattress sales?"\n` +
      `• **Market comparison**: "Compare HK vs Taiwan"\n` +
      `• **Revenue**: "What's the total revenue for Hong Kong?"\n` +
      `• **Competitors**: "Who are Emma's competitors in Taiwan?"\n` +
      `• **Methodology**: "How does the attachment rate model work?"\n\n` +
      `Currently viewing: **${market === 'HK' ? 'Hong Kong' : 'Taiwan'}** ` +
      `(${d.total_orders.toLocaleString()} orders, ${d.symbol}${(d.total_revenue/1e6).toFixed(1)}M revenue)`,
    source: null,
  };
}

function classifyAndRespond(query, market) {
  const q = query.toLowerCase();
  for (const intent of INTENTS) {
    for (const pattern of intent.patterns) {
      if (pattern.test(q)) {
        return intent.handler(query, market);
      }
    }
  }
  return fallbackResponse(query, market);
}

// ── Suggested Starter Questions ──────────────────────────────────────────────
const STARTER_QUESTIONS = [
  'What happens if we raise prices by 15%?',
  'Compare HK vs Taiwan',
  'Which pillows cannibalize sales?',
  'How price-sensitive is this market?',
];

// ── Chat Message Component ───────────────────────────────────────────────────
function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  // Simple markdown-ish rendering (bold, bullets, tables)
  const renderText = (text) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Table rows
      if (line.startsWith('|')) {
        if (line.match(/^\|[-| ]+\|$/)) return null; // separator row
        const cells = line.split('|').filter(Boolean).map(c => c.trim());
        const isHeader = i < lines.length - 1 && lines[i + 1]?.match(/^\|[-| ]+\|$/);
        return (
          <div key={i} className={`grid grid-cols-${cells.length} gap-1 text-xs ${isHeader ? 'font-semibold border-b border-gray-200 pb-1 mb-1' : ''}`}
               style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
            {cells.map((cell, j) => <span key={j}>{renderInline(cell)}</span>)}
          </div>
        );
      }
      // Bullet points
      if (line.startsWith('• ') || line.startsWith('- ')) {
        return <div key={i} className="flex gap-2 ml-2 my-0.5"><span className="text-orange-400">•</span><span>{renderInline(line.slice(2))}</span></div>;
      }
      // Empty line
      if (line.trim() === '') return <div key={i} className="h-2" />;
      // Normal text
      return <p key={i} className="my-0.5">{renderInline(line)}</p>;
    });
  };

  const renderInline = (text) => {
    // Bold
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
    );
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-orange-500 text-white rounded-br-md'
          : 'bg-white border border-gray-200 text-gray-700 rounded-bl-md shadow-sm'
      }`}>
        <div className="text-sm leading-relaxed">{renderText(message.content)}</div>
        {message.source && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5">
            <svg className="w-3 h-3 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
            </svg>
            <span className="text-xs text-purple-500 font-medium">{message.source}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ChatBot Component ───────────────────────────────────────────────────
export default function ChatBot({ market = 'HK' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Hi! I'm the BAMP Analytics Assistant. I can answer questions about Emma Sleep's pricing models, market data, and econometric analysis.\n\nCurrently viewing **${market === 'HK' ? 'Hong Kong' : 'Taiwan'}**. Try one of the suggested questions below, or ask anything about pricing, elasticity, attachment rates, or the portfolio.`,
        source: null,
      }]);
    }
  }, [isOpen]);

  // Reset on market change
  useEffect(() => {
    if (messages.length > 0) {
      setMessages([{
        role: 'assistant',
        content: `Switched to **${market === 'HK' ? 'Hong Kong' : 'Taiwan'}** market. How can I help you analyze this market?`,
        source: null,
      }]);
    }
  }, [market]);

  const handleSend = (text) => {
    const query = text || input.trim();
    if (!query) return;

    // Add user message
    const userMsg = { role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate brief "thinking" delay for natural feel
    setTimeout(() => {
      const response = classifyAndRespond(query, market);
      setMessages(prev => [...prev, { role: 'assistant', content: response.text, source: response.source }]);
      setIsTyping(false);
    }, 400 + Math.random() * 600);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Unread indicator
  const hasUnread = !isOpen && messages.length > 0;

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[420px] h-[560px] bg-gray-50 rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-[60] animate-fadeIn overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 px-5 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">BAMP Analytics</h3>
                <p className="text-gray-400 text-xs">Powered by econometric models</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">
                {market === 'HK' ? 'HK' : 'TW'}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}
            {isTyping && (
              <div className="flex justify-start mb-3">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-1.5">
                {STARTER_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-3 py-1.5 hover:bg-orange-100 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4 pt-2 bg-white border-t border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-200 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about pricing, elasticity, markets..."
                className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder-gray-400"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className="p-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:hover:bg-orange-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-[60] transition-all duration-300 ${
          isOpen
            ? 'bg-gray-700 hover:bg-gray-600 rotate-0'
            : 'bg-orange-500 hover:bg-orange-600 hover:scale-105'
        }`}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </>
        )}
      </button>
    </>
  );
}

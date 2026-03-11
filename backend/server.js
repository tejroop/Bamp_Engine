const express = require('express');
const cors = require('cors');
const path = require('path');
const forecastRoutes = require('./routes/forecast');
const simulateRoutes = require('./routes/simulate');
const incr = require('./models/incrementality');
const bridge = require('./models/prophet_bridge');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    modules: {
      incrementality: typeof incr.calculateLogLinearDemand === 'function',
      prophet_bridge: typeof bridge.generateMarketForecast === 'function'
    }
  });
});

// Routes
app.use('/api/forecast', forecastRoutes);
app.use('/api/simulate', simulateRoutes);

// Direct endpoints
app.get('/api/incrementality', (req, res) => {
  const { market = 'HK' } = req.query;
  // Return all product data with beta coefficients
  const products = incr.PILLOW_BETA_COEFFICIENTS || {};
  const productList = Object.entries(products).map(([sku, data]) => ({
    sku,
    ...data,
    significant: incr.isCoefficientSignificant(sku),
    beta2: incr.getBetaCoefficient(sku)
  }));
  res.json({ market, products: productList });
});

app.get('/api/markets', (req, res) => {
  res.json({
    markets: [
      { code: 'HK', name: 'Hong Kong', currency: 'HKD', symbol: 'HK$', mattresses: 5, pillows: 8, toppers: 2, duvets: 2 },
      { code: 'TW', name: 'Taiwan', currency: 'TWD', symbol: 'NT$', mattresses: 5, pillows: 7, toppers: 2, duvets: 2 }
    ]
  });
});

app.get('/api/portfolio', (req, res) => {
  const { market = 'HK' } = req.query;
  const products = incr.PILLOW_BETA_COEFFICIENTS || {};
  const incremental = [];
  const cannibalizing = [];
  const neutral = [];

  Object.entries(products).forEach(([sku, data]) => {
    const beta = incr.getBetaCoefficient(sku);
    const sig = incr.isCoefficientSignificant(sku);
    const entry = { sku, beta2: beta, significant: sig, ...data };
    if (!sig) neutral.push(entry);
    else if (beta > 0) incremental.push(entry);
    else cannibalizing.push(entry);
  });

  res.json({
    market,
    recommendation: 'Reduce portfolio from 12 to 5 pillows',
    keep: ['EPWAM', 'EPWCF', 'EPWCM', 'EPWGM', 'EPWGF'],
    remove: ['EPWFT', 'EPWBF', 'EPWMP', 'EPWFP', 'EPWBM', 'EPWAF', 'EPWAC'],
    incremental,
    cannibalizing,
    neutral,
    total_incremental_nr: 3595,
    total_incremental_gm: 1780
  });
});

// Serve static frontend in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  } else {
    next();
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`\n  BAMP Market Response Engine API`);
  console.log(`  ================================`);
  console.log(`  Server:  http://localhost:${PORT}`);
  console.log(`  Health:  http://localhost:${PORT}/api/health`);
  console.log(`  Markets: http://localhost:${PORT}/api/markets`);
  console.log(`  ================================\n`);
});

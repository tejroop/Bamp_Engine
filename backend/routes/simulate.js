const express = require('express');
const router = express.Router();
const axios = require('axios');
const bridge = require('../models/prophet_bridge');
const incr = require('../models/incrementality');

// POST /api/simulate-price
router.post('/price', async (req, res) => {
  try {
    const {
      market = 'HK',
      mattress_price = 400,
      marketing_spend = 50000,
      competitor_gap = 0
    } = req.body;

    // Try Python API first
    try {
      const response = await axios.post(
        'http://localhost:5000/api/simulate-price',
        { market, mattress_price, marketing_spend, competitor_gap },
        { timeout: 5000 }
      );
      res.json(response.data);
    } catch (pythonError) {
      // Fall back to JS-based simulation
      const simulation = bridge.forecastAttachmentRateImpact(market, mattress_price, marketing_spend);
      res.json({ source: 'js-fallback', ...simulation });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/simulate-portfolio
router.post('/portfolio', async (req, res) => {
  try {
    const { market = 'HK', remove_products = [] } = req.body;
    const results = remove_products.map(sku => {
      const beta = incr.getBetaCoefficient(sku);
      return {
        sku,
        beta2: beta,
        significant: incr.isCoefficientSignificant(sku),
        removal_impact: incr.simulateProductRemoval(sku, 100, 1000)
      };
    });
    res.json({ market, removals: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/elasticity/:market
router.get('/elasticity/:market', async (req, res) => {
  try {
    const { market } = req.params;
    try {
      const response = await axios.get(
        `http://localhost:5000/api/elasticity?market=${market}`,
        { timeout: 5000 }
      );
      res.json(response.data);
    } catch (pythonError) {
      // JS fallback: calculate elasticity from pre-set coefficients
      const marketCoeffs = { HK: -0.95, TW: -1.08 };
      const k = marketCoeffs[market] || -1.0;
      const avgPrice = market === 'HK' ? 3100 : 12000;
      const avgQty = market === 'HK' ? 420 : 610;
      const elasticity = incr.calculatePriceElasticity(k, avgPrice, avgQty);
      res.json({
        source: 'js-fallback',
        market,
        regression_coefficient: k,
        price_elasticity: elasticity,
        avg_price: avgPrice,
        avg_quantity: avgQty,
        interpretation: Math.abs(elasticity) > 1 ? 'elastic' : 'inelastic'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

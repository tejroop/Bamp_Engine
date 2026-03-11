const express = require('express');
const router = express.Router();
const axios = require('axios');
const bridge = require('../models/prophet_bridge');

// GET /api/forecast/:market
router.get('/:market', async (req, res) => {
  try {
    const { market } = req.params;
    const { periods = 90 } = req.query;

    // Try Python API first, fall back to JS bridge
    try {
      const response = await axios.post(
        'http://localhost:5000/api/forecast',
        { market, periods: parseInt(periods) },
        { timeout: 5000 }
      );
      res.json(response.data);
    } catch (pythonError) {
      const forecast = bridge.generateMarketForecast(market, parseInt(periods));
      res.json({ source: 'js-fallback', ...forecast });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/forecast/attachment-rate/:market
router.get('/attachment-rate/:market', async (req, res) => {
  try {
    const { market } = req.params;
    const data = bridge.calculateAttachmentRateOptimum(market);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

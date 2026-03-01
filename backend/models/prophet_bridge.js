/**
 * BAMP Prophet Bridge Module
 * 
 * This module bridges to an external Python Flask API for advanced forecasting
 * using Facebook's Prophet library. If the Python service is unavailable, it
 * falls back to a pure JavaScript implementation using Fourier series for
 * trend and seasonality decomposition.
 * 
 * Python API Endpoint: http://localhost:5000
 */

/**
 * Fourier series implementation for seasonality modeling
 * Used in JavaScript fallback when Python service is unavailable
 * 
 * @param {number} t - Time index (0 to period length)
 * @param {number} period - Period length (365 for yearly, 52 for weekly)
 * @param {number} order - Fourier order (number of sine/cosine pairs)
 * @returns {array} Array of Fourier features [sin, cos, sin, cos, ...]
 */
function generateFourierFeatures(t, period, order) {
  const features = [];
  for (let i = 1; i <= order; i++) {
    const arg = (2 * Math.PI * i * t) / period;
    features.push(Math.sin(arg));
    features.push(Math.cos(arg));
  }
  return features;
}

/**
 * Calculate linear trend component
 * 
 * @param {number} t - Time index
 * @param {array} data - Historical data points
 * @returns {number} Trend value at time t
 */
function calculateTrend(t, data) {
  if (data.length < 2) return data[0] || 0;
  
  // Simple linear regression for trend
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumX2 += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return intercept + slope * t;
}

/**
 * Fit Fourier series to historical data
 * Determines optimal coefficients for seasonal pattern replication
 * 
 * @param {array} data - Historical time series data
 * @param {number} period - Period length
 * @param {number} order - Fourier order
 * @returns {array} Fourier coefficients [coef0, coef1, coef2, ...]
 */
function fitFourierCoefficients(data, period, order) {
  const n = data.length;
  const features = [];
  
  // Generate feature matrix
  for (let t = 0; t < n; t++) {
    const fourierFeats = generateFourierFeatures(t, period, order);
    features.push([1, ...fourierFeats]); // Include intercept
  }
  
  // Simple least-squares fit (normal equations)
  // y = X * beta, where beta = (X'X)^-1 * X'y
  const numFeatures = 1 + 2 * order;
  const XtX = Array(numFeatures).fill(0).map(() => Array(numFeatures).fill(0));
  const Xty = Array(numFeatures).fill(0);
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < numFeatures; j++) {
      for (let k = 0; k < numFeatures; k++) {
        XtX[j][k] += features[i][j] * features[i][k];
      }
      Xty[j] += features[i][j] * data[i];
    }
  }
  
  // Solve using Gaussian elimination (simplified)
  const beta = solveLinearSystem(XtX, Xty);
  return beta;
}

/**
 * Solve Ax = b using Gaussian elimination
 * 
 * @param {array} A - Coefficient matrix
 * @param {array} b - Result vector
 * @returns {array} Solution vector x
 */
function solveLinearSystem(A, b) {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);
  
  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    
    // Swap rows
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
    
    // Eliminate column
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }
  
  // Back substitution
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }
  
  return x;
}

/**
 * JavaScript fallback forecast using Fourier series
 * Implements basic trend + seasonality model when Python API unavailable
 * 
 * @param {array} historicalData - Array of historical quantity values
 * @param {number} periods - Number of periods to forecast
 * @param {number} yearlyOrder - Fourier order for yearly seasonality (default: 10)
 * @param {number} weeklyOrder - Fourier order for weekly seasonality (default: 3)
 * @returns {object} Forecast with trend, seasonality, and confidence intervals
 */
function generateJavaScriptForecast(historicalData, periods = 30, yearlyOrder = 10, weeklyOrder = 3) {
  if (!historicalData || historicalData.length === 0) {
    return {
      error: 'No historical data provided',
      forecast: [],
      components: { trend: [], yearly: [], weekly: [] }
    };
  }
  
  const n = historicalData.length;
  const forecast = [];
  const trend = [];
  const yearly = [];
  const weekly = [];
  
  // Calculate trend
  const trendValues = [];
  for (let i = 0; i < n + periods; i++) {
    trendValues.push(calculateTrend(i, historicalData.slice(0, Math.min(i + 1, n))));
  }
  
  // Fit yearly Fourier components
  const yearlyCoeffs = fitFourierCoefficients(historicalData, 365, yearlyOrder);
  
  // Fit weekly Fourier components
  const weeklyCoeffs = fitFourierCoefficients(historicalData, 52, weeklyOrder);
  
  // Generate forecast
  for (let i = n; i < n + periods; i++) {
    const trendVal = trendValues[i];
    
    const yearlyFeats = generateFourierFeatures(i, 365, yearlyOrder);
    let yearlyVal = yearlyCoeffs[0]; // Intercept
    for (let j = 0; j < yearlyFeats.length; j++) {
      yearlyVal += yearlyCoeffs[j + 1] * yearlyFeats[j];
    }
    
    const weeklyFeats = generateFourierFeatures(i, 52, weeklyOrder);
    let weeklyVal = weeklyCoeffs[0]; // Intercept
    for (let j = 0; j < weeklyFeats.length; j++) {
      weeklyVal += weeklyCoeffs[j + 1] * weeklyFeats[j];
    }
    
    const forecastValue = trendVal + yearlyVal + weeklyVal;
    const forecastValueAdjusted = Math.max(0, forecastValue); // Prevent negative forecasts
    
    forecast.push({
      timestamp: new Date(Date.now() + (i - n) * 24 * 60 * 60 * 1000),
      forecast: Math.round(forecastValueAdjusted * 100) / 100,
      trend: Math.round(trendVal * 100) / 100,
      yearly_seasonality: Math.round(yearlyVal * 100) / 100,
      weekly_seasonality: Math.round(weeklyVal * 100) / 100,
      lower_bound: Math.round((forecastValueAdjusted * 0.85) * 100) / 100,
      upper_bound: Math.round((forecastValueAdjusted * 1.15) * 100) / 100
    });
    
    trend.push(Math.round(trendVal * 100) / 100);
    yearly.push(Math.round(yearlyVal * 100) / 100);
    weekly.push(Math.round(weeklyVal * 100) / 100);
  }
  
  return {
    forecast,
    components: { trend, yearly, weekly },
    metadata: {
      method: 'JavaScript Fourier Fallback',
      historicalPoints: n,
      forecastPeriods: periods,
      yearlyOrder,
      weeklyOrder
    }
  };
}

/**
 * Call Python Flask API for Prophet forecast
 * Falls back to JavaScript implementation if API unavailable
 * 
 * @param {array} historicalData - Array of quantities
 * @param {number} periods - Number of periods to forecast
 * @param {object} options - Configuration options
 * @returns {promise} Forecast object
 */
async function callProphetAPI(historicalData, periods = 30, options = {}) {
  const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:5000';
  
  try {
    // Attempt to call Python Flask API
    const response = await fetch(`${pythonApiUrl}/forecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        historical_data: historicalData,
        periods: periods,
        yearly_seasonality_order: options.yearlyOrder || 10,
        weekly_seasonality_order: options.weeklyOrder || 3,
        daily_seasonality: options.dailySeasonality || false
      }),
      timeout: 5000
    });
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    const data = await response.json();
    return {
      ...data,
      metadata: {
        ...data.metadata,
        source: 'Python Prophet API'
      }
    };
  } catch (error) {
    console.warn(`Python API unavailable (${error.message}), using JavaScript fallback`);
    
    // Fallback to JavaScript implementation
    return generateJavaScriptForecast(
      historicalData,
      periods,
      options.yearlyOrder || 10,
      options.weeklyOrder || 3
    );
  }
}

/**
 * Calculate optimal attachment rate price point
 * Based on empirical research showing interior optimum around €400 for mattresses
 * This represents the sweet spot where cross-sell attachment rate peaks
 * 
 * @param {number} mattressPrice - Base mattress price
 * @param {number} optimalPrice - Price at which attachment maximizes (default: 400)
 * @returns {number} Estimated attachment rate
 */
function calculateAttachmentRateOptimum(mattressPrice, optimalPrice = 400) {
  // Quadratic model with maximum at optimalPrice
  // attachment_rate = a - b * (price - optimalPrice)^2
  const a = 0.75; // Maximum possible attachment rate
  const b = 0.0001; // Curvature parameter
  
  const deviation = mattressPrice - optimalPrice;
  const attachmentRate = a - b * (deviation * deviation);
  
  return Math.max(0, Math.min(1, attachmentRate)); // Clamp to [0, 1]
}

/**
 * Generate market forecast combining multiple signals
 * 
 * @param {object} marketData - Market transaction data
 * @param {number} periods - Forecast periods
 * @returns {object} Comprehensive market forecast
 */
async function generateMarketForecast(marketData, periods = 30) {
  if (!marketData || !marketData.transactions) {
    return {
      error: 'Market data not provided',
      forecast: []
    };
  }
  
  // Extract quantity time series
  const quantityData = marketData.transactions.map(t => t.quantity);
  
  // Get forecast
  const forecast = await callProphetAPI(quantityData, periods, {
    yearlyOrder: 10,
    weeklyOrder: 3
  });
  
  // Calculate revenue implications
  const avgPrice = marketData.transactions.reduce((sum, t) => sum + t.unit_price, 0) / 
                   marketData.transactions.length;
  
  const forecastWithRevenue = {
    ...forecast,
    revenue_forecast: forecast.forecast.map(f => ({
      ...f,
      revenue: Math.round(f.forecast * avgPrice * 100) / 100,
      revenue_lower: Math.round(f.lower_bound * avgPrice * 100) / 100,
      revenue_upper: Math.round(f.upper_bound * avgPrice * 100) / 100
    }))
  };
  
  return forecastWithRevenue;
}

/**
 * Forecast attachment rate cross-sell impact
 * Projects how pricing affects pillow/accessory attachment to mattresses
 * 
 * @param {number} mattressPrice - Base mattress price
 * @param {number} historicalAttachmentRate - Current attachment rate
 * @param {number} forecastPeriods - Number of periods to forecast
 * @returns {object} Attachment rate forecast
 */
function forecastAttachmentRateImpact(mattressPrice, historicalAttachmentRate, forecastPeriods = 12) {
  const forecast = [];
  
  // Project price evolution
  const priceGrowthRate = 0.02; // 2% annual growth assumption
  
  for (let i = 0; i < forecastPeriods; i++) {
    const projectedPrice = mattressPrice * Math.pow(1 + priceGrowthRate, i / 12);
    const attachmentRate = calculateAttachmentRateOptimum(projectedPrice);
    
    // Smoothing toward optimum
    const smoothedAttachment = (attachmentRate + historicalAttachmentRate) / 2;
    
    forecast.push({
      period: i + 1,
      projected_price: Math.round(projectedPrice * 100) / 100,
      estimated_attachment_rate: Math.round(smoothedAttachment * 10000) / 10000,
      attachment_optimality: Math.round(attachmentRate * 10000) / 10000,
      potential_attachment_lift: Math.round((attachmentRate - historicalAttachmentRate) * 10000) / 10000
    });
  }
  
  return {
    mattress_base_price: mattressPrice,
    forecast
  };
}

module.exports = {
  callProphetAPI,
  generateJavaScriptForecast,
  generateMarketForecast,
  calculateAttachmentRateOptimum,
  forecastAttachmentRateImpact,
  generateFourierFeatures,
  calculateTrend,
  fitFourierCoefficients
};

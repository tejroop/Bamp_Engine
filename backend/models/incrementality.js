/**
 * BAMP Incrementality Module
 * 
 * This module implements the log-linear elasticity model for demand prediction
 * and incrementality analysis. It calculates the relationship between price,
 * quantity, marketing spend, and attachment rates.
 * 
 * Core Formula:
 * ln(QTY_P) = β₁ * ln(Price_p) + β₂ * (QTY_target / QTY_P) + β₃ * ln(Marketing_p) + ε
 * 
 * Where:
 * - QTY_P: Quantity sold
 * - Price_p: Product price
 * - QTY_target: Target/competitive quantity
 * - Marketing_p: Marketing spend
 * - β₁, β₂, β₃: Elasticity coefficients (pre-trained)
 * - ε: Error term (residual)
 */

/**
 * Pre-trained beta coefficients for pillow portfolio
 * These coefficients were derived from historical transaction data
 * and represent the elasticity of each product to price and marketing changes
 * 
 * Format: { SKU: beta_coefficient }
 * - Positive β₂: quantity increases as relative competitiveness increases
 * - Negative β₂: quantity decreases (unusual, might indicate premium positioning)
 * - "not significant": coefficient not statistically significant at 95% confidence
 */
const PILLOW_BETA_COEFFICIENTS = {
  // Significant coefficients
  'EPWFT': -5.0583,  // ClassicDown 80x80 - strong negative elasticity
  'EPWBF': -1.7994,  // MemoryFoam 60x80 - moderate negative elasticity
  'EPWDD': 1.6171,   // AllergyFree 70x70 - positive elasticity (competitive)
  'EPWAF': -5.4038,  // CoolGel 80x80 - strong negative elasticity
  'EPWAC': -0.582,   // LuxuryDown 90x90 - weak negative elasticity
  'EPWGM': 3.5582,   // ErgoSupport 65x65 - positive elasticity (value play)
  
  // Not statistically significant
  'EPWMP': 'not significant',
  'EPWFP': 'not significant',
  'EPWBM': 'not significant',
  'EPWAM': 'not significant',
  'EPWCF': 'not significant',
  'EPWCM': 'not significant',
  'EPWGF': 'not significant'
};

/**
 * Calculate log-linear demand using elasticity model
 * 
 * @param {number} price - Current product price
 * @param {number} targetQty - Target/competitive quantity benchmark
 * @param {number} actualQty - Current actual quantity sold
 * @param {number} marketing - Marketing spend for this period
 * @param {number} beta1 - Price elasticity coefficient (default: -1.2)
 * @param {number} beta2 - Relative quantity elasticity coefficient
 * @param {number} beta3 - Marketing elasticity coefficient (default: 0.4)
 * @returns {number} Estimated quantity sold using log-linear model
 */
function calculateLogLinearDemand(price, targetQty, actualQty, marketing, beta1 = -1.2, beta2, beta3 = 0.4) {
  if (!price || price <= 0 || !actualQty || actualQty <= 0 || !marketing || marketing <= 0) {
    return 0;
  }
  
  // Calculate log terms
  const logPrice = Math.log(price);
  const qtyRatio = targetQty / actualQty;
  const logMarketing = Math.log(marketing);
  
  // Apply log-linear formula
  const lnQty = (beta1 * logPrice) + (beta2 * qtyRatio) + (beta3 * logMarketing);
  
  // Exponentiate to get quantity
  return Math.exp(lnQty);
}

/**
 * Calculate price elasticity of demand
 * Elasticity = (% change in quantity) / (% change in price)
 * 
 * @param {number} basePriceQty - Quantity at base price
 * @param {number} alternativePriceQty - Quantity at alternative price
 * @param {number} basePrice - Base price point
 * @param {number} alternativePrice - Alternative price point
 * @returns {number} Price elasticity coefficient
 */
function calculatePriceElasticity(basePriceQty, alternativePriceQty, basePrice, alternativePrice) {
  if (basePrice === alternativePrice || basePriceQty === 0) {
    return 0;
  }
  
  const pctChangeQty = (alternativePriceQty - basePriceQty) / basePriceQty;
  const pctChangePrice = (alternativePrice - basePrice) / basePrice;
  
  return pctChangeQty / pctChangePrice;
}

/**
 * Calculate marketing elasticity (return on marketing spend)
 * 
 * @param {number} qtyAtBaseMktg - Quantity at base marketing spend
 * @param {number} qtyAtAltMktg - Quantity at alternative marketing spend
 * @param {number} baseMktgSpend - Base marketing spend
 * @param {number} altMktgSpend - Alternative marketing spend
 * @returns {number} Marketing elasticity coefficient
 */
function calculateMarketingElasticity(qtyAtBaseMktg, qtyAtAltMktg, baseMktgSpend, altMktgSpend) {
  if (baseMktgSpend === altMktgSpend || qtyAtBaseMktg === 0) {
    return 0;
  }
  
  const pctChangeQty = (qtyAtAltMktg - qtyAtBaseMktg) / qtyAtBaseMktg;
  const pctChangeMktg = (altMktgSpend - baseMktgSpend) / baseMktgSpend;
  
  return pctChangeQty / pctChangeMktg;
}

/**
 * Calculate incremental volume from marketing investment
 * Measures the additional units sold attributed to marketing spend
 * 
 * @param {number} actualQuantity - Actual quantity sold with marketing
 * @param {number} baselineQuantity - Expected quantity without marketing
 * @returns {number} Incremental units attributable to marketing
 */
function calculateIncrementalVolume(actualQuantity, baselineQuantity) {
  return Math.max(0, actualQuantity - baselineQuantity);
}

/**
 * Calculate Return on Marketing Investment (ROMI)
 * ROMI = (Incremental Revenue) / (Marketing Spend)
 * 
 * @param {number} incrementalQuantity - Additional units from marketing
 * @param {number} unitPrice - Selling price per unit
 * @param {number} marketingSpend - Total marketing investment
 * @param {number} marginPercent - Gross margin percentage (default: 40%)
 * @returns {object} ROMI metrics including absolute and marginal returns
 */
function calculateROMI(incrementalQuantity, unitPrice, marketingSpend, marginPercent = 0.40) {
  if (marketingSpend === 0) {
    return {
      incrementalRevenue: 0,
      incrementalProfit: 0,
      romi: 0,
      roiPercent: 0,
      profitPerDollarSpent: 0
    };
  }
  
  const incrementalRevenue = incrementalQuantity * unitPrice;
  const incrementalProfit = incrementalRevenue * marginPercent;
  const romi = incrementalRevenue / marketingSpend;
  const roiPercent = (incrementalProfit / marketingSpend) * 100;
  
  return {
    incrementalRevenue: Math.round(incrementalRevenue * 100) / 100,
    incrementalProfit: Math.round(incrementalProfit * 100) / 100,
    romi: Math.round(romi * 100) / 100,
    roiPercent: Math.round(roiPercent * 100) / 100,
    profitPerDollarSpent: Math.round((incrementalProfit / marketingSpend) * 100) / 100
  };
}

/**
 * Simulate removing a product from the portfolio
 * Calculates cannibalization and attachment rate impacts
 * 
 * @param {object} removedProduct - Product being removed
 * @param {array} portfolio - Array of all products in portfolio
 * @param {object} transactionData - Historical transaction data
 * @returns {object} Impact analysis of product removal
 */
function simulateProductRemoval(removedProduct, portfolio, transactionData) {
  const sku = removedProduct.sku;
  
  // Find related products (same category or frequently purchased together)
  const relatedProducts = portfolio.filter(p => {
    return p.sku !== sku && (
      p.product_category === removedProduct.product_category ||
      isFrequentlyBoughtTogether(sku, p.sku, transactionData)
    );
  });
  
  // Calculate current contribution
  const currentRevenue = removedProduct.quantity * removedProduct.unit_price;
  const currentMargin = currentRevenue * 0.40; // Assume 40% margin
  
  // Estimate cannibalization from related products
  let cannibalizedUnits = 0;
  let lostCrossSellOpportunities = 0;
  
  relatedProducts.forEach(related => {
    // If removed product is high attachment rate, related products suffer
    if (removedProduct.is_crosssell) {
      const cannibalRate = removedProduct.attachment_rate * 0.3; // 30% of attachment rate transfers
      cannibalizedUnits += related.quantity * cannibalRate;
    }
  });
  
  // Calculate net impact
  const recapturedUnits = relatedProducts.reduce((sum, p) => {
    // Some sales may shift to complementary products
    return sum + (p.quantity * 0.15); // 15% capture rate
  }, 0);
  
  return {
    removedSku: sku,
    removedProductName: removedProduct.product_name,
    currentRevenue: Math.round(currentRevenue * 100) / 100,
    currentMargin: Math.round(currentMargin * 100) / 100,
    estimatedCannibalizedUnits: Math.round(cannibalizedUnits),
    estimatedRecapturedUnits: Math.round(recapturedUnits),
    netUnitImpact: Math.round(recapturedUnits - cannibalizedUnits),
    impactedProducts: relatedProducts.map(p => ({
      sku: p.sku,
      name: p.product_name,
      estimatedCannibalLoss: Math.round(p.quantity * 0.15)
    }))
  };
}

/**
 * Check if two products are frequently purchased together
 * 
 * @param {string} sku1 - First product SKU
 * @param {string} sku2 - Second product SKU
 * @param {object} transactionData - Historical data
 * @returns {boolean} True if products are frequently co-purchased
 */
function isFrequentlyBoughtTogether(sku1, sku2, transactionData) {
  // This is a simplified check - in production would analyze actual co-purchase patterns
  // Pillows are frequently bought with mattresses
  const pillow_skus = ['EPWFT', 'EPWBF', 'EPWDD', 'EPWAF', 'EPWAC', 'EPWGM',
                       'HPWFT', 'HPWBF', 'HPWDD', 'HPWAF', 'HPWAC', 'HPWGM',
                       'TPWFT', 'TPWBF', 'TPWDD', 'TPWAF', 'TPWAC', 'TPWGM'];
  const mattress_skus = ['HKMQ001', 'HKMQ002', 'HKMQ003', 'HKMQ004',
                         'TWMQ001', 'TWMQ002', 'TWMQ003', 'TWMQ004'];
  
  const isPillow1 = pillow_skus.includes(sku1);
  const isMattress2 = mattress_skus.includes(sku2);
  
  return (isPillow1 && isMattress2) || (!isPillow1 && !isMattress2);
}

/**
 * Calculate incremental Net Revenue (NR) from elasticity
 * NR change = Elasticity * Price Change % * Current Revenue
 * 
 * @param {number} currentRevenue - Current period revenue
 * @param {number} priceElasticity - Price elasticity coefficient
 * @param {number} priceChangePercent - Price change as percentage (e.g., 0.10 for +10%)
 * @returns {number} Estimated change in Net Revenue
 */
function calculateIncrementalNR(currentRevenue, priceElasticity, priceChangePercent) {
  // NR change driven by volume elasticity
  const volumeChange = priceElasticity * priceChangePercent;
  const nrChangePercent = volumeChange * priceChangePercent; // Second-order effect
  
  return currentRevenue * nrChangePercent;
}

/**
 * Calculate incremental Gross Margin (GM) impact
 * Accounts for both revenue change and cost structure
 * 
 * @param {number} incrementalRevenue - Change in revenue
 * @param {number} currentMargin - Current gross margin percentage
 * @param {number} fixedCostAbsorption - Absorption of fixed costs
 * @returns {number} Change in Gross Margin dollars
 */
function calculateIncrementalGM(incrementalRevenue, currentMargin, fixedCostAbsorption = 0.05) {
  // Margin improvement from fixed cost leverage
  const marginImprovement = fixedCostAbsorption * Math.abs(incrementalRevenue);
  const gmChange = incrementalRevenue * currentMargin + marginImprovement;
  
  return Math.round(gmChange * 100) / 100;
}

/**
 * Get beta coefficient for a specific SKU
 * 
 * @param {string} sku - Product SKU
 * @param {string} market - Market code (e.g., 'HK', 'TW')
 * @returns {number|string} Beta coefficient or 'not significant'
 */
function getBetaCoefficient(sku, market = 'HK') {
  return PILLOW_BETA_COEFFICIENTS[sku] || null;
}

/**
 * Validate that a coefficient is statistically significant
 * 
 * @param {number|string} coefficient - Beta coefficient value
 * @returns {boolean} True if coefficient is significant
 */
function isCoefficientSignificant(coefficient) {
  return typeof coefficient === 'number';
}

/**
 * Calculate cross-elasticity between products
 * Measures how demand for product A changes when price of product B changes
 * 
 * @param {number} qtyAOriginal - Original quantity of product A
 * @param {number} qtyAAfterBPriceChange - Quantity of A after B's price change
 * @param {number} priceBOriginal - Original price of product B
 * @param {number} priceBNew - New price of product B
 * @returns {number} Cross-elasticity coefficient
 */
function calculateCrossElasticity(qtyAOriginal, qtyAAfterBPriceChange, priceBOriginal, priceBNew) {
  if (priceBOriginal === priceBNew || qtyAOriginal === 0) {
    return 0;
  }
  
  const pctChangeQtyA = (qtyAAfterBPriceChange - qtyAOriginal) / qtyAOriginal;
  const pctChangePriceB = (priceBNew - priceBOriginal) / priceBOriginal;
  
  return pctChangeQtyA / pctChangePriceB;
}

/**
 * Estimate breakeven point for promotional pricing
 * 
 * @param {number} currentPrice - Current product price
 * @param {number} currentQty - Current quantity sold
 * @param {number} priceElasticity - Price elasticity coefficient
 * @param {number} marginPercent - Gross margin percentage
 * @returns {object} Breakeven analysis
 */
function calculatePromotionalBreakeven(currentPrice, currentQty, priceElasticity, marginPercent) {
  const currentMargin = currentPrice * marginPercent;
  
  // Find discount threshold where profit stays neutral
  // Breakeven discount: -priceElasticity * discountPercent = 1
  const breakEvenDiscount = 1 / Math.abs(priceElasticity);
  const breakEvenPrice = currentPrice * (1 - breakEvenDiscount);
  
  return {
    currentPrice: Math.round(currentPrice * 100) / 100,
    currentMargin: Math.round(currentMargin * 100) / 100,
    maxProfitableDiscount: Math.round(breakEvenDiscount * 10000) / 100 + '%',
    breakEvenPrice: Math.round(breakEvenPrice * 100) / 100,
    breakEvenQtyRequired: Math.round(currentQty * (1 + (priceElasticity * breakEvenDiscount)))
  };
}

module.exports = {
  calculateLogLinearDemand,
  calculatePriceElasticity,
  calculateMarketingElasticity,
  calculateIncrementalVolume,
  calculateROMI,
  simulateProductRemoval,
  isFrequentlyBoughtTogether,
  calculateIncrementalNR,
  calculateIncrementalGM,
  getBetaCoefficient,
  isCoefficientSignificant,
  calculateCrossElasticity,
  calculatePromotionalBreakeven,
  PILLOW_BETA_COEFFICIENTS
};

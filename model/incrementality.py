"""
BAMP Incrementality Analysis Module

This module implements portfolio-level impact analysis using the log-linear
incrementality model from De Haes et al. (2016) and the BAMP pillow analysis.

CORE METHODOLOGY:

The log-linear incrementality regression model:

    ln(QTY_P) = β₀ + β₁ * ln(Price_p) + β₂ * (QTY_target / QTY_P) + β₃ * ln(Marketing_p) + ε

Where:
    QTY_P: Quantity sold of product P
    Price_p: Price of product P
    QTY_target: Sales of the "target" or "hero" product
    Marketing_p: Marketing spend on product P
    
    β₁ (Price elasticity): Expected negative (-0.8 to -1.5 typical)
    β₂ (Portfolio impact): KEY COEFFICIENT
         - β₂ > 0: Positive incrementality (target product BOOSTS companion sales)
         - β₂ < 0: Cannibalization (target product REDUCES companion sales)
         - Magnitude: 1% increase in target share → β₂% change in companion demand
    
    β₃ (Marketing elasticity): Expected positive (0.3 to 0.6 typical)

INTERPRETATION OF β₂ (Portfolio Impact):

The coefficient β₂ in the term (QTY_target / QTY_P) measures how a 1% change in
the ratio of target product to companion product affects companion sales:

EXAMPLE: EPWGM (positive incrementality, β₂ = 3.5582)
    If we increase EPWDD (target) sales by 1% while holding EPWGM constant:
    - The ratio QTY_EPWDD / QTY_EPWGM increases by 1%
    - EPWGM demand increases by 3.5582% (through cross-selling)
    - This is POSITIVE INCREMENTALITY: selling EPWDD helps sell EPWGM
    - 356% incrementality means: for every 100€ net revenue in EPWDD,
      we generate 356€ net revenue in EPWGM (at current volumes)

EXAMPLE: EPWFT (negative incrementality, β₂ = -5.0583)
    If we increase EPWDD sales by 1%:
    - The ratio increases by 1%
    - EPWFT demand DECREASES by 5.0583% (cannibalization)
    - Customers choose EPWDD over EPWFT
    - Portfolio impact is NEGATIVE

DE PILLOW ANALYSIS RESULTS:

The following β₂ coefficients are pre-loaded from regression analysis of
German (DE) market data with EPWDD as the target product:

Product  | β₂ Coefficient | Interpretation          | NR Impact | GM Impact
---------|----------------|-------------------------|-----------|----------
EPWFT    | -5.0583        | Strong cannibalization  |     N/A   |    N/A
EPWBF    | -1.7994        | Moderate cannibalization|     N/A   |    N/A
EPWDD    | 1.6171         | Baseline (target)       |   632K€   |   157K€
EPWAF    | -5.4038        | Strong cannibalization  |     N/A   |    N/A
EPWAC    | -0.582         | Mild cannibalization    |     N/A   |    N/A
EPWGM    | 3.5582         | Strong incrementality   |  2963K€   |  1623K€

BUSINESS APPLICATIONS:

1. PORTFOLIO OPTIMIZATION:
   Given limited marketing budget, which products should we promote?
   - Products with positive β₂ are "heroes" - promote them to boost portfolio
   - Products with negative β₂ should share shelf-space carefully
   - EPWGM + EPWDD bundle generates highest portfolio value

2. CANNIBALIZATION ANALYSIS:
   If we cut EPWFT prices, do we hurt overall revenue?
   - EPWFT has negative β₂ with EPWDD
   - Lower EPWFT prices → customers switch FROM EPWDD TO EPWFT
   - If EPWFT margin is higher, this might be good
   - If EPWDD margin is higher, this hurts profitability

3. PRODUCT MIX DECISIONS:
   Should we discontinue a cannibalizing product?
   - EPWFT cannibalization cost: -5.06% EPWDD per 1% EPWFT growth
   - But EPWFT might have high margin or serve different customer segment
   - Decision requires full P&L analysis, not just incrementality
"""

import pandas as pd
import numpy as np
from typing import Dict, Tuple, List


class IncrementalityAnalyzer:
    """
    Portfolio incrementality analysis using log-linear regression coefficients.
    
    This class manages β₂ coefficients (portfolio impact) and calculates:
    - Incremental revenue/margin from cross-selling
    - Cannibalization effects
    - Portfolio simulation under different product mix scenarios
    """
    
    def __init__(self, market_code='DE'):
        """
        Initialize with market-specific incrementality coefficients.
        
        Args:
            market_code (str): Market identifier ('DE', 'HK', 'TW')
        """
        self.market_code = market_code
        
        # β₂ coefficients from DE pillow analysis (EPWDD as target)
        # These are pre-fitted from historical regression analysis
        if market_code == 'DE':
            self.beta_2_coefficients = {
                'EPWFT': -5.0583,   # Strong cannibalization
                'EPWBF': -1.7994,   # Moderate cannibalization
                'EPWDD': 1.6171,    # Target product (baseline)
                'EPWAF': -5.4038,   # Strong cannibalization
                'EPWAC': -0.582,    # Mild cannibalization
                'EPWGM': 3.5582     # Strong incrementality
            }
            
            # Financial impact data from pillow analysis
            self.financial_data = {
                'EPWDD': {'NR': 632000, 'GM': 157000},      # Target product
                'EPWGM': {'NR': 2963000, 'GM': 1623000}     # Positive incrementality
            }
        
        elif market_code == 'HK':
            # Hong Kong market coefficients (illustrative - would be updated with real data)
            self.beta_2_coefficients = {
                'EPWFT': -4.2,
                'EPWBF': -1.5,
                'EPWDD': 1.4,
                'EPWAF': -4.8,
                'EPWAC': -0.5,
                'EPWGM': 3.0
            }
            self.financial_data = {
                'EPWDD': {'NR': 550000, 'GM': 140000},
                'EPWGM': {'NR': 2500000, 'GM': 1400000}
            }
        
        elif market_code == 'TW':
            # Taiwan market coefficients
            self.beta_2_coefficients = {
                'EPWFT': -4.5,
                'EPWBF': -1.6,
                'EPWDD': 1.5,
                'EPWAF': -5.0,
                'EPWAC': -0.6,
                'EPWGM': 3.2
            }
            self.financial_data = {
                'EPWDD': {'NR': 600000, 'GM': 150000},
                'EPWGM': {'NR': 2800000, 'GM': 1500000}
            }
        
        else:
            raise ValueError(f"Unknown market code: {market_code}")
    
    def get_beta_2(self, product_code):
        """
        Retrieve β₂ coefficient for a product.
        
        Args:
            product_code (str): Product identifier
            
        Returns:
            float: Portfolio impact coefficient (β₂)
            
        Raises:
            KeyError: If product not in registry
        """
        if product_code not in self.beta_2_coefficients:
            raise KeyError(f"Product {product_code} not found in {self.market_code} market")
        
        return self.beta_2_coefficients[product_code]
    
    def is_positive_incrementality(self, product_code):
        """
        Determine if product has positive (β₂ > 0) or negative (β₂ < 0) incrementality.
        
        Args:
            product_code (str): Product identifier
            
        Returns:
            bool: True if β₂ > 0 (positive incrementality), False if β₂ < 0 (cannibalization)
        """
        return self.get_beta_2(product_code) > 0
    
    def calculate_portfolio_impact(self, target_product, companion_product, 
                                   target_qty_change_percent=1.0):
        """
        Calculate the impact on companion product sales from a change in target product.
        
        FORMULA:
            Δ(ln(QTY_companion)) = β₂ * Δ(QTY_target / QTY_companion)
        
        For a 1% increase in target product:
            Impact_percent = β₂ * 1.0
        
        Args:
            target_product (str): Product being promoted (driver)
            companion_product (str): Product affected by promotion (driven)
            target_qty_change_percent (float): Change in target product sales (%)
            
        Returns:
            dict: Impact analysis with percentages and interpretation
        """
        beta_2 = self.get_beta_2(companion_product)
        
        # In log-linear model: Δ ln(y) ≈ percentage change for small changes
        impact_percent = beta_2 * target_qty_change_percent
        
        interpretation = "POSITIVE INCREMENTALITY" if beta_2 > 0 else "CANNIBALIZATION"
        
        return {
            'target_product': target_product,
            'companion_product': companion_product,
            'beta_2_coefficient': beta_2,
            'target_qty_change_percent': target_qty_change_percent,
            'companion_impact_percent': impact_percent,
            'interpretation': interpretation,
            'direction': 'positive' if impact_percent > 0 else 'negative',
            'magnitude': abs(impact_percent)
        }
    
    def calculate_incremental_revenue(self, target_product, companion_product,
                                     baseline_qty_companion=1000, 
                                     baseline_price=100,
                                     target_qty_change_percent=1.0):
        """
        Calculate incremental revenue from portfolio impact.
        
        Given:
        - Current companion product sales: baseline_qty_companion
        - Companion product price: baseline_price
        - Change in target product: target_qty_change_percent
        
        Calculate:
        - Incremental units sold (from portfolio impact)
        - Incremental revenue
        - Incremental gross margin (using financial data if available)
        
        Args:
            target_product (str): Product being promoted
            companion_product (str): Product affected
            baseline_qty_companion (float): Current units/period of companion
            baseline_price (float): Price per unit of companion
            target_qty_change_percent (float): Change in target product (%)
            
        Returns:
            dict: Incremental revenue/margin analysis
        """
        # Get portfolio impact
        impact = self.calculate_portfolio_impact(
            target_product, companion_product, target_qty_change_percent
        )
        
        # In log-linear model: e^(Δ ln(y)) ≈ 1 + Δ ln(y) for small changes
        # But for larger impacts, use: new_qty = old_qty * e^(Δ ln(y))
        qty_multiplier = np.exp(impact['companion_impact_percent'] / 100)
        incremental_qty = baseline_qty_companion * (qty_multiplier - 1)
        incremental_revenue = incremental_qty * baseline_price
        
        result = {
            'target_product': target_product,
            'companion_product': companion_product,
            'beta_2_coefficient': impact['beta_2_coefficient'],
            'baseline_qty': baseline_qty_companion,
            'baseline_price': baseline_price,
            'baseline_revenue': baseline_qty_companion * baseline_price,
            'target_qty_change_percent': target_qty_change_percent,
            'quantity_impact_percent': impact['companion_impact_percent'],
            'incremental_qty': incremental_qty,
            'incremental_revenue': incremental_revenue,
            'interpretation': impact['interpretation']
        }
        
        # Add gross margin impact if available
        if companion_product in self.financial_data:
            gm_ratio = (self.financial_data[companion_product]['GM'] / 
                       self.financial_data[companion_product]['NR'])
            result['baseline_gross_margin'] = self.financial_data[companion_product]['GM']
            result['incremental_gross_margin'] = incremental_revenue * gm_ratio
        
        return result
    
    def analyze_portfolio(self, target_product, baseline_volumes=None):
        """
        Comprehensive portfolio analysis when promoting a target product.
        
        Shows impact on all companion products when target product is increased.
        Helps identify:
        - Which products are boosted (positive β₂)
        - Which products are cannibalized (negative β₂)
        - Overall portfolio impact
        
        Args:
            target_product (str): Product being promoted
            baseline_volumes (dict): Current sales volumes by product
                                    {product: qty, ...}
            
        Returns:
            dict: Portfolio-level analysis
        """
        if baseline_volumes is None:
            # Use default volumes if not provided
            baseline_volumes = {
                product: 1000 for product in self.beta_2_coefficients.keys()
            }
        
        impacts = []
        total_incremental_revenue = 0
        total_incremental_margin = 0
        
        for product in self.beta_2_coefficients.keys():
            if product == target_product:
                continue  # Skip target product itself
            
            impact = self.calculate_incremental_revenue(
                target_product=target_product,
                companion_product=product,
                baseline_qty_companion=baseline_volumes.get(product, 1000),
                baseline_price=100,  # Assume standard price
                target_qty_change_percent=1.0
            )
            
            impacts.append(impact)
            total_incremental_revenue += impact['incremental_revenue']
            
            if 'incremental_gross_margin' in impact:
                total_incremental_margin += impact['incremental_gross_margin']
        
        # Sort by impact magnitude
        impacts_sorted = sorted(
            impacts,
            key=lambda x: abs(x['incremental_revenue']),
            reverse=True
        )
        
        return {
            'target_product': target_product,
            'market': self.market_code,
            'companion_impacts': impacts_sorted,
            'total_incremental_revenue_per_1pct': total_incremental_revenue,
            'total_incremental_margin_per_1pct': total_incremental_margin,
            'net_portfolio_effect': 'positive' if total_incremental_revenue > 0 else 'negative'
        }
    
    def simulate_product_removal(self, removed_product, baseline_volumes=None):
        """
        Simulate portfolio impact if we discontinue a product.
        
        Shows how much revenue is lost from cannibalization of other products
        if we remove a cannibalizing product (e.g., remove EPWFT to reduce
        cannibalization of EPWDD).
        
        Args:
            removed_product (str): Product to remove from portfolio
            baseline_volumes (dict): Current volumes by product
            
        Returns:
            dict: Impact of product removal
        """
        if baseline_volumes is None:
            baseline_volumes = {
                product: 1000 for product in self.beta_2_coefficients.keys()
            }
        
        # When we remove a product, all other products are no longer cannibalized by it
        # This is equivalent to a -100% change in the removed product
        effects = []
        
        for product in self.beta_2_coefficients.keys():
            if product == removed_product:
                continue
            
            # Impact on other products from removing this product
            # A -100% change in removed_product → impact_percent of change in other products
            beta_2 = self.get_beta_2(product)
            impact_percent = -100 * beta_2  # Negative change in removed product
            
            qty_multiplier = np.exp(impact_percent / 100)
            baseline_qty = baseline_volumes.get(product, 1000)
            incremental_qty = baseline_qty * (qty_multiplier - 1)
            incremental_revenue = incremental_qty * 100  # Assume price = 100
            
            effects.append({
                'product': product,
                'beta_2': beta_2,
                'liberation_percent': impact_percent,
                'incremental_qty': incremental_qty,
                'incremental_revenue': incremental_revenue
            })
        
        # Lost revenue from removing the product itself
        removed_qty = baseline_volumes.get(removed_product, 1000)
        removed_revenue = removed_qty * 100
        
        # Net revenue change
        total_gained = sum(e['incremental_revenue'] for e in effects)
        net_change = total_gained - removed_revenue
        
        return {
            'removed_product': removed_product,
            'removed_revenue': removed_revenue,
            'liberation_effects': effects,
            'total_volume_recovered': sum(e['incremental_qty'] for e in effects),
            'total_revenue_recovered': total_gained,
            'net_revenue_change': net_change,
            'recommendation': (
                'KEEP PRODUCT' if net_change < 0 
                else 'CONSIDER REMOVAL' if net_change > 0 
                else 'NEUTRAL'
            )
        }
    
    def get_all_coefficients(self):
        """
        Return all β₂ coefficients for the market.
        
        Returns:
            dict: {product_code: beta_2_coefficient, ...}
        """
        return self.beta_2_coefficients.copy()
    
    def get_positive_incrementality_products(self):
        """
        Identify all products with positive incrementality (β₂ > 0).
        
        These are "hero" products that boost other sales.
        
        Returns:
            list: Product codes with β₂ > 0, sorted by magnitude descending
        """
        products = [
            (code, beta_2) 
            for code, beta_2 in self.beta_2_coefficients.items() 
            if beta_2 > 0
        ]
        return sorted(products, key=lambda x: x[1], reverse=True)
    
    def get_cannibalization_products(self):
        """
        Identify all cannibalizing products (β₂ < 0).
        
        These products reduce sales of others (when target product increases).
        
        Returns:
            list: Product codes with β₂ < 0, sorted by magnitude descending
        """
        products = [
            (code, beta_2) 
            for code, beta_2 in self.beta_2_coefficients.items() 
            if beta_2 < 0
        ]
        return sorted(products, key=lambda x: abs(x[1]), reverse=True)


if __name__ == '__main__':
    print("=" * 80)
    print("BAMP INCREMENTALITY ANALYSIS - DEMONSTRATION")
    print("=" * 80)
    
    # Initialize analyzer for DE market
    analyzer = IncrementalityAnalyzer(market_code='DE')
    
    # 1. Show all coefficients
    print("\n1. MARKET COEFFICIENTS (β₂)")
    print("-" * 80)
    for product, beta_2 in analyzer.get_all_coefficients().items():
        direction = "POSITIVE" if beta_2 > 0 else "NEGATIVE"
        print(f"  {product}: β₂ = {beta_2:7.4f}  ({direction} incrementality)")
    
    # 2. Positive vs negative products
    print("\n2. POSITIVE INCREMENTALITY PRODUCTS (Heroes)")
    print("-" * 80)
    for product, beta_2 in analyzer.get_positive_incrementality_products():
        print(f"  {product}: +{beta_2:.2f}% per 1% target increase")
    
    print("\n3. CANNIBALIZATION PRODUCTS (Threats)")
    print("-" * 80)
    for product, beta_2 in analyzer.get_cannibalization_products():
        print(f"  {product}: {beta_2:.2f}% per 1% target increase (NEGATIVE)")
    
    # 3. Portfolio impact analysis
    print("\n4. PORTFOLIO IMPACT: Promoting EPWDD")
    print("-" * 80)
    portfolio = analyzer.analyze_portfolio('EPWDD')
    
    print(f"\nTotal incremental revenue per 1% EPWDD increase: €{portfolio['total_incremental_revenue_per_1pct']:,.0f}")
    print(f"Net portfolio effect: {portfolio['net_portfolio_effect'].upper()}")
    
    print("\nImpact on companion products:")
    for impact in portfolio['companion_impacts'][:3]:
        sign = "+" if impact['incremental_revenue'] > 0 else ""
        print(f"  {impact['companion_product']:6s}: {sign}€{impact['incremental_revenue']:8,.0f} "
              f"({impact['interpretation'][:3]}...)")
    
    # 4. Product removal analysis
    print("\n5. WHAT IF WE REMOVE EPWFT (Strong Cannibalizer)?")
    print("-" * 80)
    removal = analyzer.simulate_product_removal('EPWFT')
    
    print(f"Lost revenue from EPWFT removal: €{removal['removed_revenue']:,.0f}")
    print(f"Recovered revenue (liberation): €{removal['total_revenue_recovered']:,.0f}")
    print(f"Net change: €{removal['net_revenue_change']:,.0f}")
    print(f"Recommendation: {removal['recommendation']}")
    
    # 5. Incremental revenue calculation
    print("\n6. INCREMENTAL REVENUE ANALYSIS")
    print("-" * 80)
    inc_rev = analyzer.calculate_incremental_revenue(
        target_product='EPWDD',
        companion_product='EPWGM',
        baseline_qty_companion=1500,
        baseline_price=250,
        target_qty_change_percent=5.0
    )
    
    print(f"Scenario: 5% increase in EPWDD sales")
    print(f"Effect on EPWGM:")
    print(f"  Current sales: {inc_rev['baseline_qty']:.0f} units @ €{inc_rev['baseline_price']}")
    print(f"  Current revenue: €{inc_rev['baseline_revenue']:,.0f}")
    print(f"  Impact: {inc_rev['quantity_impact_percent']:+.2f}%")
    print(f"  Incremental units: {inc_rev['incremental_qty']:+.0f}")
    print(f"  Incremental revenue: €{inc_rev['incremental_revenue']:+,.0f}")
    
    if 'incremental_gross_margin' in inc_rev:
        print(f"  Incremental gross margin: €{inc_rev['incremental_gross_margin']:+,.0f}")
    
    print("\n" + "=" * 80)

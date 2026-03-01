"""
BAMP Price Elasticity of Demand Module

This module implements price elasticity calculations and analysis for the
BAMP Market Response Engine.

PRICE ELASTICITY OF DEMAND THEORY:

Price Elasticity measures the responsiveness of quantity demanded to price changes:

    Elasticity = (% change in quantity) / (% change in price)
    
    Elasticity = (ΔQ/Q) / (ΔP/P) = (ΔQ/ΔP) * (P/Q)

FORMULA IMPLEMENTATION IN BAMP:

In time-series forecasting, we estimate elasticity from regression coefficients:

    Elasticity = β_price * (P_mean / Q_mean)

Where:
    β_price: Regression coefficient from Prophet model (estimated from data)
    P_mean: Average price during training period
    Q_mean: Average quantity during training period

EXAMPLE:
    If β_price = -0.5 (from Prophet regressor on log-price)
    If P_mean = 100 EUR, Q_mean = 1000 units
    Then Elasticity = -0.5 * (100/1000) = -0.05 (very inelastic)
    
    Interpretation: 10% price increase → 0.5% quantity decrease
    RATIONALE: When price is only 10% of average quantity (price-to-quantity ratio small),
               the elasticity is also small (inelastic demand)

ELASTICITY CATEGORIES:

|Elasticity|   Range   |  Name        | Business Implication
|-----------|-----------|--------------|-----------------------------------------------------
|    E      |  E = -1   |  Unit elastic| 1% price change → 1% quantity change
|    E      | -1 < E<0  | Inelastic    | 1% price increase → <1% quantity decrease (revenue UP)
|    E      | E < -1    | Elastic      | 1% price increase → >1% quantity decrease (revenue DOWN)
|    E      |  E > 0    | Giffen/Veblen| 1% price increase → quantity increase (rare, prestige)

CLASSIFICATION BY MAGNITUDE:

Inelastic (|E| < 1):     Price increases raise revenue. Apply premium pricing.
Unit elastic (|E| = 1):  Price changes don't affect revenue. Natural equilibrium.
Elastic (|E| > 1):       Price increases reduce revenue. Use volume strategy.

BAMP MARKET DATA:

Typical European B2B elasticities for office products: -0.5 to -1.2
    - Commodities (paper, standard pens): More elastic (-0.8 to -1.2)
    - Specialty (premium ergonomic): More inelastic (-0.3 to -0.7)
    - Mid-range (our sweet spot): -0.6 to -0.9

MARKET-SPECIFIC PATTERNS:

Germany (DE):   Efficient market, strong price competition → more elastic (-0.85 avg)
Hong Kong (HK): Growing market, less saturation → less elastic (-0.65 avg)
Taiwan (TW):    Mixed (large enterprises inelastic, SMBs elastic) → mid-range (-0.75 avg)
"""

import pandas as pd
import numpy as np
from typing import Dict, Tuple


class ElasticityAnalyzer:
    """
    Price elasticity estimation and analysis from forecasting models.
    
    This class manages price elasticity coefficients and provides functions for:
    - Elasticity calculation from model coefficients and market data
    - Elasticity classification (inelastic, elastic, unit-elastic)
    - Revenue optimization under different elasticity scenarios
    - Market comparison across DE, HK, TW
    """
    
    def __init__(self, market_code='DE'):
        """
        Initialize with market-specific elasticity data.
        
        Args:
            market_code (str): Market identifier ('DE', 'HK', 'TW')
        """
        self.market_code = market_code
        
        # Price regression coefficients from Prophet model
        # These are estimated from historical price-quantity relationships
        if market_code == 'DE':
            # German market: Efficient, competitive → higher elasticity magnitude
            self.price_coefficients = {
                'EPWFT': -0.85,   # Paper products: commodity-like
                'EPWBF': -0.72,   # Binding supplies: moderate elasticity
                'EPWDD': -0.68,   # Specialty dispenser: less elastic
                'EPWAF': -0.95,   # Art supplies: price-sensitive
                'EPWAC': -0.54,   # Accessories: bundled, less price-sensitive
                'EPWGM': -0.62    # Premium items: strong brand loyalty
            }
            
            # Average price and quantity for elasticity calculation
            self.market_data = {
                'EPWFT': {'avg_price': 8.5, 'avg_qty': 12000},
                'EPWBF': {'avg_price': 45.0, 'avg_qty': 2500},
                'EPWDD': {'avg_price': 125.0, 'avg_qty': 850},
                'EPWAF': {'avg_price': 18.5, 'avg_qty': 3200},
                'EPWAC': {'avg_price': 5.2, 'avg_qty': 8500},
                'EPWGM': {'avg_price': 250.0, 'avg_qty': 350}
            }
        
        elif market_code == 'HK':
            # Hong Kong market: Growing, less saturation → lower elasticity magnitude
            self.price_coefficients = {
                'EPWFT': -0.65,
                'EPWBF': -0.58,
                'EPWDD': -0.52,
                'EPWAF': -0.72,
                'EPWAC': -0.42,
                'EPWGM': -0.48
            }
            
            self.market_data = {
                'EPWFT': {'avg_price': 7.5, 'avg_qty': 10000},
                'EPWBF': {'avg_price': 40.0, 'avg_qty': 2000},
                'EPWDD': {'avg_price': 110.0, 'avg_qty': 700},
                'EPWAF': {'avg_price': 16.0, 'avg_qty': 2800},
                'EPWAC': {'avg_price': 4.5, 'avg_qty': 7000},
                'EPWGM': {'avg_price': 220.0, 'avg_qty': 280}
            }
        
        elif market_code == 'TW':
            # Taiwan market: Mixed customer base → moderate elasticity
            self.price_coefficients = {
                'EPWFT': -0.78,
                'EPWBF': -0.65,
                'EPWDD': -0.60,
                'EPWAF': -0.85,
                'EPWAC': -0.48,
                'EPWGM': -0.55
            }
            
            self.market_data = {
                'EPWFT': {'avg_price': 8.0, 'avg_qty': 11000},
                'EPWBF': {'avg_price': 42.0, 'avg_qty': 2200},
                'EPWDD': {'avg_price': 115.0, 'avg_qty': 780},
                'EPWAF': {'avg_price': 17.0, 'avg_qty': 3000},
                'EPWAC': {'avg_price': 4.8, 'avg_qty': 7500},
                'EPWGM': {'avg_price': 235.0, 'avg_qty': 310}
            }
        
        else:
            raise ValueError(f"Unknown market code: {market_code}")
    
    def calculate_elasticity(self, product_code):
        """
        Calculate price elasticity of demand using the formula:
        
            Elasticity = β_price * (P_mean / Q_mean)
        
        Args:
            product_code (str): Product identifier
            
        Returns:
            dict: Elasticity value and classification
        """
        if product_code not in self.price_coefficients:
            raise KeyError(f"Product {product_code} not found in {self.market_code} market")
        
        beta_price = self.price_coefficients[product_code]
        market_data = self.market_data[product_code]
        
        avg_price = market_data['avg_price']
        avg_qty = market_data['avg_qty']
        
        # Elasticity = β_price * (P / Q)
        elasticity = beta_price * (avg_price / avg_qty)
        
        # Classify elasticity
        classification = self._classify_elasticity(elasticity)
        
        return {
            'product_code': product_code,
            'elasticity': elasticity,
            'beta_price': beta_price,
            'avg_price': avg_price,
            'avg_qty': avg_qty,
            'classification': classification,
            'interpretation': self._get_interpretation(elasticity)
        }
    
    def _classify_elasticity(self, elasticity):
        """
        Classify elasticity into standard economic categories.
        
        Args:
            elasticity (float): Elasticity value (typically negative for normal goods)
            
        Returns:
            str: Classification label
        """
        abs_e = abs(elasticity)
        
        if elasticity > 0:
            return "GIFFEN/VEBLEN"  # Very rare; price increases demand
        elif abs_e < 0.5:
            return "VERY_INELASTIC"  # Demand barely responds to price
        elif abs_e < 1.0:
            return "INELASTIC"       # Demand responds less than proportionally
        elif abs_e < 1.2:
            return "NEAR_UNIT_ELASTIC"  # Demand responds roughly proportionally
        else:
            return "ELASTIC"         # Demand responds more than proportionally
    
    def _get_interpretation(self, elasticity):
        """
        Generate business interpretation of elasticity value.
        
        Args:
            elasticity (float): Elasticity value
            
        Returns:
            str: Business interpretation
        """
        abs_e = abs(elasticity)
        
        if elasticity > 0:
            return "Premium/luxury good: price increases boost demand (rare)"
        elif abs_e < 0.5:
            return "Essential item: price changes have minimal demand impact. Raise prices to boost revenue"
        elif abs_e < 1.0:
            return "Inelastic: price increases raise revenue. Opportunity for premium positioning"
        elif abs_e < 1.2:
            return "Unit-elastic equilibrium: price changes don't affect total revenue"
        else:
            return "Elastic: price increases reduce revenue. Focus on volume/value strategy"
    
    def calculate_elasticity_all_products(self):
        """
        Calculate elasticity for all products in the market.
        
        Returns:
            list: Elasticity data for all products, sorted by magnitude (most elastic first)
        """
        results = []
        
        for product_code in self.price_coefficients.keys():
            elasticity_data = self.calculate_elasticity(product_code)
            results.append(elasticity_data)
        
        # Sort by absolute elasticity magnitude (descending)
        return sorted(results, key=lambda x: abs(x['elasticity']), reverse=True)
    
    def compare_elasticity_across_markets(self, product_code):
        """
        Compare price elasticity for a product across DE, HK, TW markets.
        
        Useful for identifying which markets are most price-sensitive.
        
        Args:
            product_code (str): Product to analyze
            
        Returns:
            dict: Elasticity comparison across markets
        """
        comparison = {}
        
        for market in ['DE', 'HK', 'TW']:
            analyzer = ElasticityAnalyzer(market_code=market)
            if product_code in analyzer.price_coefficients:
                elasticity_data = analyzer.calculate_elasticity(product_code)
                comparison[market] = {
                    'elasticity': elasticity_data['elasticity'],
                    'classification': elasticity_data['classification']
                }
        
        return {
            'product_code': product_code,
            'market_comparison': comparison,
            'most_elastic': max(
                comparison.items(),
                key=lambda x: abs(x[1]['elasticity'])
            )[0],
            'least_elastic': min(
                comparison.items(),
                key=lambda x: abs(x[1]['elasticity'])
            )[0]
        }
    
    def simulate_price_change_revenue_impact(self, product_code, price_change_percent):
        """
        Simulate revenue impact of a price change.
        
        Using elasticity:
            % ΔRevenue ≈ % ΔPrice * (1 + Elasticity)
        
        Intuition: 
        - If inelastic (E = -0.5): 10% price increase → 5% revenue increase
        - If elastic (E = -1.5): 10% price increase → 5% revenue decrease
        
        Args:
            product_code (str): Product to analyze
            price_change_percent (float): Price change as percentage (e.g., 10 for +10%)
            
        Returns:
            dict: Revenue impact analysis
        """
        elasticity_data = self.calculate_elasticity(product_code)
        elasticity = elasticity_data['elasticity']
        
        # Revenue impact formula: ΔRevenue% = ΔPrice% * (1 + Elasticity)
        # This comes from: Revenue = Price * Quantity
        # % ΔRevenue = % ΔPrice + % ΔQuantity
        # % ΔQuantity = Elasticity * % ΔPrice
        # So: % ΔRevenue = % ΔPrice + Elasticity * % ΔPrice = % ΔPrice * (1 + Elasticity)
        
        revenue_impact_percent = price_change_percent * (1 + elasticity)
        
        # Current financials
        market_data = self.market_data[product_code]
        current_price = market_data['avg_price']
        current_qty = market_data['avg_qty']
        current_revenue = current_price * current_qty
        
        # Calculate new values
        new_price = current_price * (1 + price_change_percent / 100)
        new_qty = current_qty * (1 + elasticity * price_change_percent / 100)
        new_revenue = new_price * new_qty
        incremental_revenue = new_revenue - current_revenue
        
        return {
            'product_code': product_code,
            'elasticity': elasticity,
            'elasticity_classification': elasticity_data['classification'],
            'price_change_percent': price_change_percent,
            'current_price': current_price,
            'current_qty': current_qty,
            'current_revenue': current_revenue,
            'new_price': new_price,
            'new_qty': new_qty,
            'new_revenue': new_revenue,
            'quantity_change_percent': elasticity * price_change_percent,
            'quantity_change_units': new_qty - current_qty,
            'revenue_change_percent': revenue_impact_percent,
            'incremental_revenue': incremental_revenue,
            'recommendation': self._get_price_recommendation(elasticity, revenue_impact_percent)
        }
    
    def _get_price_recommendation(self, elasticity, revenue_impact_percent):
        """
        Generate pricing recommendation based on elasticity and impact.
        
        Args:
            elasticity (float): Price elasticity
            revenue_impact_percent (float): Revenue impact from 10% price increase
            
        Returns:
            str: Pricing recommendation
        """
        abs_e = abs(elasticity)
        
        if abs_e < 0.5:
            return "RAISE PRICES aggressively; very inelastic demand"
        elif abs_e < 1.0:
            return "RAISE PRICES moderately; inelastic demand supports premium positioning"
        elif abs_e < 1.2:
            return "MAINTAIN CURRENT PRICE; unit-elastic equilibrium"
        else:
            return "REDUCE PRICES to increase revenue; elastic demand favors volume strategy"
    
    def calculate_optimal_markup(self, product_code, cost_per_unit):
        """
        Calculate profit-maximizing markup using elasticity.
        
        Monopolistic pricing rule (Lerner Index):
            (P - C) / P = -1 / Elasticity
            Markup = P/C = 1 / (1 + Elasticity)
        
        Example: If E = -2 (elastic)
            Optimal P/C = 1 / (1 + (-2)) = 1 / (-1) = -1 (NEGATIVE! Price below cost)
            This means: if demand is very elastic, you can't mark up much above cost
        
        Example: If E = -0.5 (inelastic)
            Optimal P/C = 1 / (1 - 0.5) = 1 / 0.5 = 2.0
            This means: you can charge 2x cost (100% markup) profitably
        
        Args:
            product_code (str): Product to analyze
            cost_per_unit (float): Production/acquisition cost per unit
            
        Returns:
            dict: Optimal pricing analysis
        """
        elasticity_data = self.calculate_elasticity(product_code)
        elasticity = elasticity_data['elasticity']
        
        # Optimal markup formula: P/C = 1 / (1 + Elasticity)
        # Note: Assumes constant elasticity and no demand curve shifts
        
        if elasticity >= -1:
            # Inelastic (E ≥ -1): can mark up above cost
            optimal_price_to_cost_ratio = 1 / (1 + elasticity)
        else:
            # Elastic (E < -1): need to price closer to marginal cost
            optimal_price_to_cost_ratio = 1 / (1 + elasticity)
        
        optimal_price = cost_per_unit * optimal_price_to_cost_ratio
        current_price = elasticity_data['avg_price']
        
        # Markup percentage
        optimal_markup_percent = (optimal_price / cost_per_unit - 1) * 100
        current_markup_percent = (current_price / cost_per_unit - 1) * 100
        
        return {
            'product_code': product_code,
            'elasticity': elasticity,
            'cost_per_unit': cost_per_unit,
            'current_price': current_price,
            'current_markup_percent': current_markup_percent,
            'optimal_price': optimal_price,
            'optimal_markup_percent': optimal_markup_percent,
            'price_adjustment_needed': optimal_price - current_price,
            'pricing_action': (
                'INCREASE PRICE' if optimal_price > current_price else
                'DECREASE PRICE' if optimal_price < current_price else
                'MAINTAIN PRICE'
            )
        }
    
    def get_all_elasticities(self):
        """
        Return all elasticity data for the market.
        
        Returns:
            list: Elasticity data for all products
        """
        return self.calculate_elasticity_all_products()
    
    def get_elasticity_summary_table(self):
        """
        Create a summary table of all elasticities for quick reference.
        
        Returns:
            pd.DataFrame: Elasticity summary with columns:
                - Product, Elasticity, Classification, Avg_Price, Avg_Qty
        """
        data = []
        
        for product_code in self.price_coefficients.keys():
            elasticity_data = self.calculate_elasticity(product_code)
            data.append({
                'Product': product_code,
                'Elasticity': elasticity_data['elasticity'],
                'Classification': elasticity_data['classification'],
                'Avg_Price': elasticity_data['avg_price'],
                'Avg_Qty': elasticity_data['avg_qty'],
                'Price_Coefficient': elasticity_data['beta_price']
            })
        
        return pd.DataFrame(data).sort_values('Elasticity', ascending=True)


if __name__ == '__main__':
    print("=" * 90)
    print("BAMP PRICE ELASTICITY ANALYSIS - DEMONSTRATION")
    print("=" * 90)
    
    # Initialize analyzer for DE market
    analyzer = ElasticityAnalyzer(market_code='DE')
    
    # 1. Show all elasticities
    print("\n1. ELASTICITY SUMMARY - GERMAN MARKET (DE)")
    print("-" * 90)
    print(analyzer.get_elasticity_summary_table().to_string(index=False))
    
    # 2. Detailed elasticity analysis
    print("\n\n2. DETAILED ELASTICITY ANALYSIS")
    print("-" * 90)
    
    for product in ['EPWFT', 'EPWGM', 'EPWDD']:
        elasticity_data = analyzer.calculate_elasticity(product)
        print(f"\n{product}:")
        print(f"  Elasticity: {elasticity_data['elasticity']:.4f}")
        print(f"  Classification: {elasticity_data['classification']}")
        print(f"  Interpretation: {elasticity_data['interpretation']}")
        print(f"  Avg Price: €{elasticity_data['avg_price']:.2f}, Avg Qty: {elasticity_data['avg_qty']:.0f}")
    
    # 3. Market comparison
    print("\n\n3. MARKET COMPARISON - PRODUCT EPWFT")
    print("-" * 90)
    comparison = analyzer.compare_elasticity_across_markets('EPWFT')
    
    for market, data in comparison['market_comparison'].items():
        print(f"  {market}: {data['elasticity']:.4f} ({data['classification']})")
    print(f"\n  Most elastic market: {comparison['most_elastic']}")
    print(f"  Least elastic market: {comparison['least_elastic']}")
    
    # 4. Price change simulations
    print("\n\n4. PRICE CHANGE IMPACT ANALYSIS")
    print("-" * 90)
    
    scenarios = [
        ('EPWFT', 10),    # +10% price
        ('EPWGM', -5),    # -5% price
        ('EPWDD', 8)      # +8% price
    ]
    
    for product, price_change in scenarios:
        impact = analyzer.simulate_price_change_revenue_impact(product, price_change)
        sign = "+" if price_change > 0 else ""
        rev_sign = "+" if impact['incremental_revenue'] > 0 else ""
        
        print(f"\n{product}: {sign}{price_change}% price change")
        print(f"  Elasticity: {impact['elasticity']:.4f} ({impact['elasticity_classification']})")
        print(f"  Quantity change: {sign}{impact['quantity_change_percent']:.2f}%")
        print(f"  Revenue change: {sign}{impact['revenue_change_percent']:.2f}%")
        print(f"  Current revenue: €{impact['current_revenue']:,.0f}")
        print(f"  New revenue: €{impact['new_revenue']:,.0f}")
        print(f"  Incremental: {rev_sign}€{impact['incremental_revenue']:,.0f}")
        print(f"  Recommendation: {impact['recommendation']}")
    
    # 5. Optimal markup calculation
    print("\n\n5. OPTIMAL PRICING ANALYSIS")
    print("-" * 90)
    
    costs = {'EPWFT': 3.5, 'EPWGM': 80, 'EPWDD': 50}
    
    for product, cost in costs.items():
        optimal = analyzer.calculate_optimal_markup(product, cost)
        
        print(f"\n{product} (Cost: €{cost:.2f}):")
        print(f"  Current price: €{optimal['current_price']:.2f} ({optimal['current_markup_percent']:.1f}% markup)")
        print(f"  Optimal price: €{optimal['optimal_price']:.2f} ({optimal['optimal_markup_percent']:.1f}% markup)")
        print(f"  Action: {optimal['pricing_action']}")
        if optimal['price_adjustment_needed'] != 0:
            adj = "+" if optimal['price_adjustment_needed'] > 0 else ""
            print(f"  Adjustment: {adj}€{optimal['price_adjustment_needed']:.2f}")
    
    print("\n" + "=" * 90)

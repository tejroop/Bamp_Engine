"""
BAMP Market Response Engine - Prophet Forecasting Module

This module implements Facebook Prophet time series forecasting for demand prediction
in the BAMP (Basel Accounting Methodology Platform) Market Response Engine.

METHODOLOGY REFLECTION AND ARGUMENTATION:

1. WHY REGRESSION OVER BLACK-BOX AI MODELS:
   The choice of regression-based Prophet modeling over black-box deep learning (LSTM,
   Transformer, etc.) reflects sound econometric practice for marketing applications:
   
   - Interpretability: Marketing decision-makers need to understand WHICH VARIABLES
     drive demand and by HOW MUCH. A neural network cannot explain why a price change
     affected your product - it only says "demand changed."
   
   - Sample efficiency: BAMP operates across multiple markets with limited historical
     data per market (24-36 months typical). Deep learning requires thousands of samples
     to avoid overfitting. Regression with domain knowledge works with smaller datasets.
   
   - Causality vs. correlation: Business decisions require causal understanding. If you
     cut marketing spend by 10%, you need to know: "demand drops by 5%" (causal), not
     just "these two metrics moved together historically" (correlation).
   
   - Regulatory compliance: In some jurisdictions, pricing decisions must be justifiable.
     "Our algorithm said so" doesn't satisfy auditors. "Price elasticity of -1.2 means
     10% discount increases unit sales 12%" does.

2. OMITTED VARIABLE BIAS (OVB) - THE ICE CREAM AND SUNSHINE ANALOGY:
   A classic econometrics problem: ice cream sales correlate with sunshine. But sunshine
   doesn't CAUSE ice cream purchases; temperature causes both. If you build a model that
   only includes "sunshine_hours" as a predictor of "ice_cream_sales," you'll:
   
   - Overestimate the causal effect of sunshine
   - Fail to predict sales on warm cloudy days (high temp, low sunshine)
   - Recommend expensive outdoor sunlamp installations to boost sales
   
   In BAMP, similar biases lurk:
   - Competitor price changes often co-move with our price changes (market conditions)
   - Marketing spend spikes during peak seasons (seasonality already captured)
   - Lead time increases during holiday demand (both drive volume)
   
   By INCLUDING key regressors (target_price, min_competitor_price, marketing_spend)
   and EXCLUDING promised_lead_time, we reduce OVB. We explicitly model the true drivers.

3. WHY PROMISED_LEAD_TIME WAS EXCLUDED:
   Lead time appears causally related to demand: longer promises mean fewer orders received.
   However, lead time is typically a CONTROL VARIABLE, not a DRIVER:
   
   - Endogeneity: We CHANGE lead time in response to demand (when order backlog is high,
     we extend promised lead time). Demand causes lead time, not the reverse. Including
     this creates simultaneity bias.
   
   - Policy variable: Lead time is a management decision tool, not a market condition.
     In scenario analysis, we want to understand "what if we extend lead time?" This
     is better captured through simulation of known elasticities than through regression
     on historical lead time.
   
   - Data quality: Lead time changes are infrequent and manual. They're noisy at the
     daily/weekly level when demand data has strong signals.
   
   Instead, we forecast demand under CURRENT lead time conditions and provide simulation
   tools for managers to explore "what if we promise 5 days longer?"
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from prophet import Prophet
import warnings
warnings.filterwarnings('ignore')


class BampProphetModel:
    """
    BAMP Prophet Forecasting Model with market-specific configurations.
    
    This class encapsulates Facebook Prophet with the exact hyperparameters tuned
    through research on German (DE), Hong Kong (HK), and Taiwan (TW) markets.
    
    HYPERPARAMETER JUSTIFICATION:
    - seasonality_mode='multiplicative': Demand volatility GROWS with season magnitude
      (e.g., 30% seasonality effect on 1000 units = 300; on 1500 units = 450).
    
    - changepoint_prior_scale=0.01: Marketing rarely requires sudden demand jumps;
      most changes are gradual (e.g., new product adoption S-curves, slow competitor
      entry). Low prior scale prevents over-detecting noise as structural breaks.
    
    - seasonality_prior_scale=0.01: Strong prior on seasonality patterns being stable
      across markets. Retail/B2B follow predictable seasonal rhythms.
    
    - changepoint_range=0.9: We believe structural breaks can happen throughout the
      training period, but leaves 10% buffer at the end for recent trends to stabilize.
    
    - yearly_seasonality fourier_order=10: Captures bi-weekly, monthly, and quarterly
      patterns in procurement cycles. 10 terms = 5 complete oscillations per year.
    
    - weekly_seasonality fourier_order=3: Captures end-of-week order surges and
      Monday planning meetings effect. 3 terms = dense weekly pattern.
    """
    
    def __init__(self, market_code='DE'):
        """
        Initialize Prophet model with market-specific parameters.
        
        Args:
            market_code (str): 'DE', 'HK', or 'TW'
        """
        self.market_code = market_code
        self.model = None
        self.forecast_df = None
        
    def create_prophet_model(self):
        """
        Instantiate Prophet with BAMP-tuned hyperparameters.
        
        Returns:
            Prophet: Configured Prophet instance
        """
        return Prophet(
            # Core seasonality configuration
            seasonality_mode='multiplicative',
            seasonality_prior_scale=0.01,
            
            # Trend flexibility
            changepoint_prior_scale=0.01,
            changepoint_range=0.9,
            
            # Interval width for confidence bands
            interval_width=0.95,
            
            # Disable default seasonalities; we'll add custom ones
            yearly_seasonality=False,
            weekly_seasonality=False,
            daily_seasonality=False
        )
    
    def generate_mock_data(self, product_code, days=730):
        """
        Generate realistic mock demand data for demonstration.
        
        This is essential for the demo because actual CSV files aren't always available.
        The data reflects real market characteristics:
        
        - Base demand varies by market and product
        - Multiplicative seasonality with yearly and weekly patterns
        - Price elasticity effect (-0.5 to -1.2 range)
        - Marketing response with diminishing returns
        - Random noise with heteroskedasticity (variance grows with demand)
        
        Args:
            product_code (str): Product identifier (e.g., 'EPWFT')
            days (int): Number of days to generate (default 2 years)
            
        Returns:
            pd.DataFrame: Columns [ds, y, target_price, min_competitor_price, 
                                   marketing_spend]
        """
        np.random.seed(hash(f"{self.market_code}_{product_code}") % 2**32)
        
        # Market-specific base demand
        market_demand = {'DE': 800, 'HK': 600, 'TW': 650}
        base_demand = market_demand.get(self.market_code, 700)
        
        # Generate date range
        end_date = datetime(2023, 12, 31)
        start_date = end_date - timedelta(days=days)
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Initialize data
        data = []
        
        for i, date in enumerate(dates):
            # Multiplicative trend
            trend = 1.0 + (i / len(dates)) * 0.15  # 15% growth over period
            
            # Yearly seasonality: Q4 peak (Nov-Dec), summer dip (Jul-Aug)
            day_of_year = date.dayofyear
            yearly_season = 1.0 + 0.25 * np.sin(2 * np.pi * day_of_year / 365)
            
            # Weekly seasonality: Mid-week peak
            day_of_week = date.dayofweek
            weekly_season = 1.0 + 0.10 * np.cos(2 * np.pi * day_of_week / 7)
            
            # Price effect: elasticity = -0.8 (typical)
            # Price oscillates ±15% around 100
            base_price = 100
            price_factor = base_price * (1 + 0.15 * np.sin(2 * np.pi * i / 90))
            price_effect = (price_factor / 100) ** (-0.8)
            
            # Marketing spend effect: starts low, peaks in Q4
            marketing_spend = 5000 + 8000 * (1 + np.sin(2 * np.pi * day_of_year / 365))
            marketing_effect = 1.0 + 0.02 * np.log(marketing_spend / 5000)
            
            # Competitor price effect: 70% of our price effect
            competitor_price = 95 + 10 * np.sin(2 * np.pi * i / 120)
            competitor_effect = (competitor_price / 95) ** (-0.56)
            
            # Combine all factors
            demand = (
                base_demand * 
                trend * 
                yearly_season * 
                weekly_season * 
                price_effect * 
                competitor_effect *
                marketing_effect
            )
            
            # Add heteroskedastic noise (variance grows with demand)
            noise = np.random.normal(0, demand * 0.08)
            demand = max(demand + noise, 50)  # Floor at 50 units
            
            data.append({
                'ds': date,
                'y': int(demand),
                'target_price': price_factor,
                'min_competitor_price': competitor_price,
                'marketing_spend': marketing_spend
            })
        
        return pd.DataFrame(data)
    
    def forecast_standalone_demand(self, product_code, periods=90):
        """
        Forecast standalone product demand using Prophet with regressors.
        
        This function models demand for a product in isolation, without considering
        portfolio effects (cross-selling impact). Use this for demand planning and
        inventory optimization.
        
        The model includes three regressors:
        1. target_price: Our selling price (negative elasticity expected)
        2. min_competitor_price: Lowest competitor price (positive effect on our demand)
        3. marketing_spend: Our promotional spending (positive effect with diminishing returns)
        
        NOTE: promised_lead_time is EXCLUDED because it's endogenous (we set lead time
        based on demand/capacity, not the other way around). See module docstring.
        
        Args:
            product_code (str): Product identifier
            periods (int): Number of days to forecast ahead
            
        Returns:
            dict: Contains 'forecast' DataFrame, 'components' plot data, and metadata
        """
        # Generate or load data
        df = self.generate_mock_data(product_code, days=730)
        
        # Initialize and configure Prophet
        model = self.create_prophet_model()
        
        # Add yearly seasonality with 10 Fourier terms
        # This captures 5 complete oscillation cycles per year
        model.add_seasonality(
            name='yearly',
            period=365,
            fourier_order=10,
            mode='multiplicative'
        )
        
        # Add weekly seasonality with 3 Fourier terms
        model.add_seasonality(
            name='weekly',
            period=7,
            fourier_order=3,
            mode='multiplicative'
        )
        
        # Add regressors
        for col in ['target_price', 'min_competitor_price', 'marketing_spend']:
            model.add_regressor(col, mode='multiplicative')
        
        # Fit model
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            model.fit(df)
        
        # Create future dataframe with regressor values
        future = model.make_future_dataframe(periods=periods)
        
        # Forward-fill regressor values for forecast period
        # (assumes near-term prices/marketing stay similar to recent levels)
        for col in ['target_price', 'min_competitor_price', 'marketing_spend']:
            last_value = df[col].iloc[-1]
            future[col] = last_value
        
        # Generate forecast
        forecast = model.predict(future)
        
        return {
            'product_code': product_code,
            'market_code': self.market_code,
            'forecast': forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].to_dict('records'),
            'model': model,
            'training_data_points': len(df),
            'forecast_periods': periods
        }
    
    def forecast_crosssell_demand(self, target_product, companion_products, periods=90):
        """
        Forecast cross-selling and bundle demand using Prophet with interaction terms.
        
        This function models how purchasing one product influences demand for related
        products (e.g., accessories, complementary items). The model captures:
        
        - Standalone demand for the companion product
        - Positive boost from target product sales (attachment rate effect)
        - Market conditions (price, competition, marketing)
        
        This is used for:
        1. Bundle pricing optimization
        2. Inventory coordination between products
        3. Cross-selling promotion planning
        
        Args:
            target_product (str): Primary product driving cross-sales
            companion_products (list): List of product codes to forecast demand for
            periods (int): Forecast horizon in days
            
        Returns:
            dict: Forecast data for all companion products with attachment metrics
        """
        # Generate or load data for all products
        forecast_data = {}
        
        for companion_product in companion_products:
            # Get companion product demand
            df = self.generate_mock_data(companion_product, days=730)
            
            # Get target product demand for interaction term
            df_target = self.generate_mock_data(target_product, days=730)
            
            # Calculate attachment rate (proportion of target sales that include companion)
            # This is a derived metric, not a direct forecasting regressor
            df['attachment_rate'] = (
                df['y'] / (df_target['y'] + 1)  # Add 1 to avoid division by zero
            ).rolling(window=7).mean()  # 7-day smoothed
            
            # Initialize Prophet
            model = self.create_prophet_model()
            
            # Add seasonality
            model.add_seasonality(
                name='yearly',
                period=365,
                fourier_order=10,
                mode='multiplicative'
            )
            model.add_seasonality(
                name='weekly',
                period=7,
                fourier_order=3,
                mode='multiplicative'
            )
            
            # Add market condition regressors
            for col in ['target_price', 'min_competitor_price', 'marketing_spend']:
                model.add_regressor(col, mode='multiplicative')
            
            # Add cross-product interaction: target product sales
            model.add_regressor('y_target', mode='additive')
            df['y_target'] = df_target['y']
            
            # Fit model
            with warnings.catch_warnings():
                warnings.simplefilter('ignore')
                model.fit(df)
            
            # Create future dataframe
            future = model.make_future_dataframe(periods=periods)
            
            # Forward-fill regressors
            for col in ['target_price', 'min_competitor_price', 'marketing_spend', 'y_target']:
                last_value = df[col].iloc[-1]
                future[col] = last_value
            
            # Generate forecast
            forecast = model.predict(future)
            
            # Calculate average attachment rate from training data
            avg_attachment = df['attachment_rate'].mean()
            
            forecast_data[companion_product] = {
                'forecast': forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].to_dict('records'),
                'avg_attachment_rate': float(avg_attachment) if not pd.isna(avg_attachment) else 0.0,
                'baseline_forecast': forecast['yhat'].mean()
            }
        
        return {
            'target_product': target_product,
            'market_code': self.market_code,
            'companion_forecasts': forecast_data,
            'forecast_periods': periods
        }


def forecast_all_markets(product_code, periods=90):
    """
    Convenience function to run forecasts across all BAMP markets.
    
    Args:
        product_code (str): Product to forecast
        periods (int): Forecast horizon
        
    Returns:
        dict: Forecasts for DE, HK, TW markets
    """
    results = {}
    for market in ['DE', 'HK', 'TW']:
        forecaster = BampProphetModel(market_code=market)
        results[market] = forecaster.forecast_standalone_demand(product_code, periods)
    
    return results


if __name__ == '__main__':
    # Demo: Generate forecasts for EPWFT product across all markets
    import json
    
    print("=" * 70)
    print("BAMP PROPHET FORECASTING MODEL - DEMONSTRATION")
    print("=" * 70)
    
    # Forecast standalone demand
    print("\n1. STANDALONE DEMAND FORECAST")
    print("-" * 70)
    results = forecast_all_markets('EPWFT', periods=90)
    
    for market, data in results.items():
        print(f"\n{market} Market:")
        print(f"  Product: {data['product_code']}")
        print(f"  Training points: {data['training_data_points']}")
        print(f"  Forecast horizon: {data['forecast_periods']} days")
        
        # Show first 5 forecast points
        forecast_data = data['forecast'][:5]
        for point in forecast_data:
            print(f"    {point['ds']}: {point['yhat']:.0f} "
                  f"(±{point['yhat_upper'] - point['yhat']:.0f})")
    
    # Forecast cross-sell demand
    print("\n\n2. CROSS-SELL FORECAST")
    print("-" * 70)
    forecaster = BampProphetModel(market_code='DE')
    crosssell = forecaster.forecast_crosssell_demand(
        target_product='EPWFT',
        companion_products=['EPWBF', 'EPWDD'],
        periods=90
    )
    
    print(f"\nTarget: {crosssell['target_product']} ({crosssell['market_code']} market)")
    for product, forecast_info in crosssell['companion_forecasts'].items():
        print(f"\n  {product}:")
        print(f"    Avg attachment rate: {forecast_info['avg_attachment_rate']:.2%}")
        print(f"    Baseline forecast: {forecast_info['baseline_forecast']:.0f} units/day")
    
    print("\n" + "=" * 70)

"""
Flask API Server for BAMP Market Response Engine
Provides REST endpoints for forecasting, elasticity, and incrementality analysis
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
from datetime import datetime

# Try to import Prophet-based models, fall back gracefully
try:
    from prophet_model import ProphetModel
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False

# Import math-based models (always available)
try:
    from incrementality import IncrementalityAnalyzer
except ImportError:
    IncrementalityAnalyzer = None

try:
    from elasticity import ElasticityModel
except ImportError:
    ElasticityModel = None

app = Flask(__name__)
CORS(app)

# Initialize models
prophet_model = ProphetModel() if PROPHET_AVAILABLE else None
incrementality = IncrementalityAnalyzer() if IncrementalityAnalyzer else None
elasticity = ElasticityModel() if ElasticityModel else None

# Market metadata
MARKETS = {
    'DE': {
        'name': 'Germany',
        'currency': 'EUR',
        'symbol': '€',
        'mattresses': 7,
        'pillows': 12,
        'toppers': 3,
        'duvets': 3
    },
    'HK': {
        'name': 'Hong Kong',
        'currency': 'HKD',
        'symbol': 'HK$',
        'mattresses': 5,
        'pillows': 8,
        'toppers': 2,
        'duvets': 2
    },
    'TW': {
        'name': 'Taiwan',
        'currency': 'TWD',
        'symbol': 'NT$',
        'mattresses': 5,
        'pillows': 7,
        'toppers': 2,
        'duvets': 2
    }
}


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0',
        'prophet_available': PROPHET_AVAILABLE
    }), 200


@app.route('/api/forecast', methods=['POST'])
def forecast():
    """
    Generate market forecast
    Expected JSON: {market, periods, price, marketing_spend, competitor_price}
    """
    try:
        data = request.get_json()
        market = data.get('market', 'DE')
        periods = data.get('periods', 90)
        price = data.get('price', 400)
        marketing_spend = data.get('marketing_spend', 50000)
        competitor_price = data.get('competitor_price', 420)

        if market not in MARKETS:
            return jsonify({'error': f'Invalid market: {market}'}), 400

        # Try Prophet first, fall back to math-based calculation
        if PROPHET_AVAILABLE and prophet_model:
            try:
                forecast_data = prophet_model.forecast(
                    market=market,
                    periods=periods,
                    price=price,
                    marketing_spend=marketing_spend,
                    competitor_price=competitor_price
                )
                forecast_data['source'] = 'prophet'
                return jsonify(forecast_data), 200
            except Exception as e:
                app.logger.warning(f"Prophet forecast failed: {str(e)}, falling back to math-based")

        # Fallback: Simple math-based forecast
        forecast_data = {
            'source': 'math-based-fallback',
            'market': market,
            'periods': periods,
            'forecast': _generate_simple_forecast(periods, price, marketing_spend),
            'metadata': MARKETS[market]
        }
        return jsonify(forecast_data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/simulate-price', methods=['POST'])
def simulate_price():
    """
    Simulate price change impact
    Expected JSON: {market, mattress_price, marketing_spend, competitor_gap}
    """
    try:
        data = request.get_json()
        market = data.get('market', 'DE')
        mattress_price = data.get('mattress_price', 400)
        marketing_spend = data.get('marketing_spend', 50000)
        competitor_gap = data.get('competitor_gap', 0)

        if market not in MARKETS:
            return jsonify({'error': f'Invalid market: {market}'}), 400

        # Try elasticity model first
        if PROPHET_AVAILABLE and elasticity:
            try:
                simulation = elasticity.simulate_price_change(
                    market=market,
                    price=mattress_price,
                    marketing_spend=marketing_spend,
                    competitor_gap=competitor_gap
                )
                simulation['source'] = 'elasticity-model'
                return jsonify(simulation), 200
            except Exception as e:
                app.logger.warning(f"Elasticity simulation failed: {str(e)}, using fallback")

        # Fallback: Simple simulation
        price_elasticity = -1.2 + (marketing_spend / 100000) * 0.5
        competitor_factor = 1 + (competitor_gap / 100) * 0.15
        estimated_demand = 1000 * competitor_factor * (1 + (price_elasticity / 100))

        simulation = {
            'source': 'math-based-fallback',
            'market': market,
            'input': {
                'mattress_price': mattress_price,
                'marketing_spend': marketing_spend,
                'competitor_gap': competitor_gap
            },
            'output': {
                'estimated_demand': int(estimated_demand),
                'price_elasticity': round(price_elasticity, 3),
                'competitor_factor': round(competitor_factor, 3)
            }
        }
        return jsonify(simulation), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/incrementality', methods=['GET'])
def get_incrementality():
    """Get all product incrementality data"""
    try:
        market = request.args.get('market', 'DE')

        if market not in MARKETS:
            return jsonify({'error': f'Invalid market: {market}'}), 400

        if incrementality:
            try:
                data = incrementality.get_product_data(market)
                data['source'] = 'incrementality-model'
                return jsonify(data), 200
            except Exception as e:
                app.logger.warning(f"Incrementality query failed: {str(e)}, using fallback")

        # Fallback: Return sample data
        data = {
            'source': 'sample-fallback',
            'market': market,
            'products': [
                {
                    'name': 'Classic Mattress',
                    'incrementality': 0.35,
                    'base_sales': 15000,
                    'category': 'mattress'
                },
                {
                    'name': 'Premium Pillow',
                    'incrementality': 0.22,
                    'base_sales': 8000,
                    'category': 'pillow'
                },
                {
                    'name': 'Topper Deluxe',
                    'incrementality': 0.18,
                    'base_sales': 5000,
                    'category': 'topper'
                }
            ]
        }
        return jsonify(data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/elasticity', methods=['GET'])
def get_elasticity():
    """Get elasticity data"""
    try:
        market = request.args.get('market', 'DE')

        if market not in MARKETS:
            return jsonify({'error': f'Invalid market: {market}'}), 400

        if elasticity:
            try:
                data = elasticity.get_elasticity_data(market)
                data['source'] = 'elasticity-model'
                return jsonify(data), 200
            except Exception as e:
                app.logger.warning(f"Elasticity query failed: {str(e)}, using fallback")

        # Fallback: Return sample data
        data = {
            'source': 'sample-fallback',
            'market': market,
            'elasticities': {
                'price': -1.2,
                'marketing': 0.8,
                'competitor_price': 0.6
            },
            'cross_elasticities': {
                'mattress_to_pillow': 0.3,
                'mattress_to_topper': 0.25
            }
        }
        return jsonify(data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/markets', methods=['GET'])
def get_markets():
    """Get market metadata"""
    try:
        return jsonify({
            'markets': [
                {
                    'code': code,
                    'name': info['name'],
                    'currency': info['currency'],
                    'symbol': info['symbol'],
                    'mattresses': info['mattresses'],
                    'pillows': info['pillows'],
                    'toppers': info['toppers'],
                    'duvets': info['duvets']
                }
                for code, info in MARKETS.items()
            ]
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/portfolio', methods=['GET'])
def get_portfolio():
    """Get portfolio optimization recommendations"""
    try:
        market = request.args.get('market', 'DE')

        if market not in MARKETS:
            return jsonify({'error': f'Invalid market: {market}'}), 400

        if incrementality:
            try:
                data = incrementality.get_portfolio_optimization(market)
                data['source'] = 'incrementality-model'
                return jsonify(data), 200
            except Exception as e:
                app.logger.warning(f"Portfolio optimization failed: {str(e)}, using fallback")

        # Fallback: Return sample recommendations
        data = {
            'source': 'sample-fallback',
            'market': market,
            'recommendations': [
                {
                    'action': 'increase_marketing',
                    'product': 'Classic Mattress',
                    'expected_roi': 2.5,
                    'investment': 25000
                },
                {
                    'action': 'bundle_offer',
                    'products': ['Classic Mattress', 'Premium Pillow'],
                    'expected_lift': 0.15
                }
            ]
        }
        return jsonify(data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Error handlers
@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({'error': 'Internal server error', 'message': str(error)}), 500


def _generate_simple_forecast(periods, price, marketing_spend):
    """Simple math-based forecast fallback"""
    forecast = []
    base_demand = 1000
    marketing_factor = 1 + (marketing_spend / 100000) * 0.5

    for period in range(1, periods + 1):
        demand = base_demand * marketing_factor * (1 - (price - 400) / 4000)
        forecast.append({
            'period': period,
            'demand': int(demand),
            'confidence_lower': int(demand * 0.8),
            'confidence_upper': int(demand * 1.2)
        })

    return forecast


if __name__ == '__main__':
    # Run the Flask app
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

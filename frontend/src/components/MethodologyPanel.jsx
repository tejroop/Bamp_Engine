import React, { useState } from 'react';

/**
 * MethodologyPanel Component
 *
 * Addresses the professor's requirement for "reflection and argumentation"
 * (from the Alter Seligenweg meeting transcript with Prof. Stahl).
 *
 * Covers:
 * 1. Prophet Model Configuration & rationale
 * 2. Incrementality formula derivation
 * 3. Why regression over black-box AI
 * 4. Omitted Variable Bias / Endogeneity (ice cream/sunshine analogy)
 * 5. Why lead time was excluded as a regressor
 * 6. Demand segmentation: Standalone vs. Cross-sell
 */

function Section({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-semibold text-gray-800">{title}</span>
        <span className="text-gray-400 text-xl">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="p-5 text-sm text-gray-700 leading-relaxed space-y-3">{children}</div>}
    </div>
  );
}

function Formula({ children }) {
  return (
    <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm my-3 overflow-x-auto">
      {children}
    </div>
  );
}

function KeyPoint({ children }) {
  return (
    <div className="bg-orange-50 border-l-4 border-orange-400 p-3 my-2">
      <p className="text-sm text-orange-900">{children}</p>
    </div>
  );
}

export default function MethodologyPanel() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">Methodology & Argumentation</h2>
        <p className="text-sm text-gray-500">
          Reflection on model choices, mathematical foundations, and academic rigor
        </p>
        <p className="text-xs text-gray-400 mt-1 italic">
          Addressing feedback from Prof. Stahl — Alter Seligenweg discussion
        </p>
      </div>

      <Section title="1. Prophet Model Configuration" defaultOpen={true}>
        <p>
          We use Facebook Prophet for time series forecasting of product demand across
          the HK and TW markets. Prophet was selected for its decomposable model
          structure (trend + seasonality + regressors) and interpretability.
        </p>

        <p className="font-semibold mt-3">Tuned Hyperparameters:</p>

        <div className="bg-gray-50 rounded-lg p-4 my-2 space-y-2 font-mono text-xs">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-gray-600">seasonality_mode:</span>
            <span className="text-blue-700 font-bold">multiplicative</span>

            <span className="text-gray-600">changepoint_prior_scale:</span>
            <span className="text-blue-700 font-bold">0.01</span>

            <span className="text-gray-600">seasonality_prior_scale:</span>
            <span className="text-blue-700 font-bold">0.01</span>

            <span className="text-gray-600">changepoint_range:</span>
            <span className="text-blue-700 font-bold">0.9</span>

            <span className="text-gray-600">yearly_seasonality:</span>
            <span className="text-blue-700 font-bold">Fourier order = 10</span>

            <span className="text-gray-600">weekly_seasonality:</span>
            <span className="text-blue-700 font-bold">Fourier order = 3</span>
          </div>
        </div>

        <p>
          <strong>Multiplicative seasonality</strong> was chosen because the magnitude of seasonal fluctuations
          in our sales data scales with the trend level — during growth periods, the seasonal swings are
          proportionally larger. This was validated via 30-day rolling MAPE cross-validation (11 folds).
        </p>

        <p>
          <strong>Changepoint Prior Scale = 0.01</strong> was selected after testing values from 0.001 to 0.1.
          The value 0.001 clearly performed worst, while 0.01 balanced flexibility vs. overfitting. A too-large
          value overfits to noise; too small underfits the trend.
        </p>

        <p>
          <strong>Changepoint Range = 0.9</strong> (vs. default 0.8) allows the model to detect trend changes
          in the last 10% of the training data, important for capturing recent market shifts.
        </p>

        <p>
          <strong>Additional Regressors:</strong> Adding Discounted Price and Marketing Spend as regressors
          reduced MAPE from ~8% to ~4%, a dramatic improvement confirming that price and marketing are
          strong demand drivers.
        </p>
      </Section>

      <Section title="2. Incrementality Formula">
        <p>
          The log-linear incrementality model quantifies how each product contributes to (or
          cannibalizes from) the total portfolio:
        </p>

        <Formula>
          ln(QTY_P) = β₁ · ln(Price_p) + β₂ · (QTY_target / QTY_P) + β₃ · ln(Marketing_p) + ε
        </Formula>

        <p>Where:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li><strong>QTY_P</strong>: Total portfolio quantity sold</li>
          <li><strong>Price_p</strong>: Discounted price of the target product</li>
          <li><strong>QTY_target / QTY_P</strong>: Share of the target product in total portfolio</li>
          <li><strong>Marketing_p</strong>: Marketing spend attributable to the product</li>
          <li><strong>ε</strong>: Error term capturing unobserved factors</li>
        </ul>

        <KeyPoint>
          The key coefficient is β₂: it measures how a 1% increase in the target product's share
          impacts the portfolio total quantity (in %). If β₂ {">"} 0, the product brings incrementality
          (new demand). If β₂ {"<"} 0, the product causes cannibalization (steals from siblings).
        </KeyPoint>

        <p>
          The log-linear specification ensures that coefficients are interpretable as elasticities
          and that the model captures non-linear relationships between variables while remaining
          a linear model in parameters (enabling OLS estimation and standard inference).
        </p>
      </Section>

      <Section title="3. Why Regression Over Black-Box AI">
        <p>
          A key architectural decision in this thesis was choosing interpretable regression models
          over black-box approaches (neural networks, gradient boosting, etc.). This choice was
          deliberate and rooted in both academic and business requirements.
        </p>

        <p className="font-semibold mt-2">Academic Argument:</p>
        <p>
          The thesis research question asks specifically about pricing levers and their effects on
          cross-selling. A black-box model would answer "what will demand be?" but cannot answer
          "which lever is driving demand and by how much?" Regression coefficients provide exactly
          this decomposition — each β has a direct economic interpretation.
        </p>

        <p className="font-semibold mt-2">Business Argument:</p>
        <p>
          As discussed with Prof. Stahl, the business team at Emma Sleep needs actionable recommendations
          that can be communicated to country managers. Telling a country manager "the neural network
          says to price at €399" is less convincing than "a €10 price reduction increases demand by 2.4%
          because the price elasticity coefficient is -1.24." The regression approach creates trust
          through transparency.
        </p>

        <KeyPoint>
          The professor's guidance: "I think the method itself might not be the challenge...
          you might see from the interpretation of the coefficients, which of these variables have
          a stronger impact." — This validates the regression approach: we can identify each lever's
          individual contribution, something black-box models cannot provide.
        </KeyPoint>

        <p className="font-semibold mt-2">Hybrid Approach:</p>
        <p>
          While we chose regression as the primary model, we use Prophet (which combines regression
          with time-series decomposition) as a hybrid. This gives us the interpretability of regression
          coefficients while also capturing complex seasonality patterns through Fourier series. The
          best of both worlds: statistical rigor with flexible time-series modeling.
        </p>
      </Section>

      <Section title="4. Omitted Variable Bias & Endogeneity">
        <p>
          Prof. Stahl raised a critical econometric concern during the thesis review: the risk
          of <strong>Omitted Variable Bias (OVB)</strong>, also known as endogeneity.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-3">
          <p className="font-bold text-blue-800 mb-2">The Ice Cream & Sunshine Analogy</p>
          <p className="text-blue-700">
            Consider ice cream sales. A naive model might find that higher ice cream prices
            correlate with higher demand. Does this mean raising prices increases sales?
            Of course not. The <strong>omitted variable is temperature (sunshine)</strong>.
            When it's hot, both demand rises (people want ice cream) AND shops raise prices
            (seasonal pricing). Without controlling for temperature, the price coefficient
            is biased upward.
          </p>
          <p className="text-blue-700 mt-2">
            Similarly, in our mattress/accessory analysis: we might observe that higher mattress
            prices correlate with higher accessory sales. But the true driver could be
            <strong> seasonal promotions</strong>, <strong>competitor actions</strong>, or
            <strong> macroeconomic conditions</strong> that simultaneously affect both pricing
            decisions and purchase behavior.
          </p>
        </div>

        <p className="font-semibold mt-2">Our Mitigation Strategy:</p>
        <ul className="list-disc list-inside space-y-2 ml-2">
          <li>
            <strong>Include control variables:</strong> Marketing spend, competitor prices, and
            seasonality components (from Prophet) act as controls that absorb some of the variation
            that would otherwise bias the price coefficient.
          </li>
          <li>
            <strong>Use relative prices:</strong> Following the professor's advice, competitor
            price information is expressed as relative differences ("5% higher than competitors")
            rather than absolute values.
          </li>
          <li>
            <strong>Acknowledge limitations:</strong> We explicitly state in the thesis that our
            price elasticity estimates may suffer from OVB. We cannot claim causal identification
            — only associative patterns. The "true" causal effect would require instruments (IV
            estimation) or natural experiments.
          </li>
          <li>
            <strong>Stepwise enrichment:</strong> As Prof. Stahl recommended, we add variables
            incrementally — first own pricing, then competitor pricing, then environmental factors —
            observing how coefficients change. Stable coefficients suggest less OVB.
          </li>
        </ul>

        <Formula>
          If Cov(Price, ε) ≠ 0 → β̂_price is biased{'\n'}
          Solution: Add controls Z such that Cov(Price, ε|Z) ≈ 0
        </Formula>
      </Section>

      <Section title="5. Lead Time Exclusion">
        <p>
          <strong>Promised Lead Time</strong> — the maximum delivery days promised at order time —
          was initially hypothesized to be a significant demand driver. The reasoning: longer lead
          times should reduce conversion rates, especially for price-sensitive buyers.
        </p>

        <p className="font-semibold mt-2">Why it was excluded:</p>

        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-red-500 font-bold mt-0.5">✗</span>
            <p><strong>Inconsistent correlation direction:</strong> The correlation between lead time
            and quantity is not consistently negative across markets. During peak sales periods, both
            sales AND lead times increase simultaneously (higher demand strains logistics).</p>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-red-500 font-bold mt-0.5">✗</span>
            <p><strong>Weak RMSE improvement:</strong> Adding lead time as a regressor showed mixed
            results across markets. The improvement was neither consistent nor significant.</p>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-red-500 font-bold mt-0.5">✗</span>
            <p><strong>Multicollinearity concern:</strong> Lead time and discounted price are negatively
            correlated (during sales, delivery also speeds up). Including both creates multicollinearity
            that inflates standard errors.</p>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-red-500 font-bold mt-0.5">✗</span>
            <p><strong>Poor economic meaning:</strong> The sign of the lead time coefficient flipped
            across markets, making the economic interpretation unreliable. A variable whose effect
            direction is ambiguous provides poor policy guidance.</p>
          </div>
        </div>

        <KeyPoint>
          Conclusion: Lead time was excluded due to its poor economic meaning and weak, non-consistent
          improvement to model prediction error. The confounding effect of seasonality on both lead
          time and demand violates the exogeneity assumption.
        </KeyPoint>
      </Section>

      <Section title="6. Demand Segmentation: Standalone vs. Cross-Sell">
        <p>
          A key methodological innovation in this analysis is separating demand into two
          distinct regression models, as proposed in the Hypothesis and EDA for Pillow Analysis.
        </p>

        <p className="font-semibold mt-2">Cross-Sell Demand Model:</p>
        <Formula>
          qty = β₁·P + β₂·All_Marketing + β₃·Cannibalizer + β₄·Lead_Time + s(t) + g(t){'\n'}
          Expected signs: β₁{'<'}0, β₂{'>'}0, β₃{'<'}0, β₄{'<'}0
        </Formula>
        <p>
          Cross-sell customers (buying accessories attached to a mattress purchase) are less
          price-sensitive because their basket size is already large. However, they are more
          responsive to marketing spend, since 90% of Emma's marketing budget targets mattress
          categories.
        </p>

        <p className="font-semibold mt-2">Standalone Demand Model:</p>
        <Formula>
          qty = β₁·P + β₂·Cannibalizer + β₃·Lead_Time + s(t) + g(t){'\n'}
          Expected signs: β₁{'<'}0, β₂{'<'}0, β₃{'<'}0
        </Formula>
        <p>
          Standalone customers (buying only accessories) are more price-sensitive and more
          sensitive to delivery times, as observed in A/B tests. Marketing spend is excluded
          here because standalone accessory buyers are typically not driven by mattress-focused
          marketing campaigns.
        </p>

        <KeyPoint>
          Why separate? Pooling both segments would average out the price sensitivity,
          giving an inaccurate elasticity estimate. Cross-sell buyers tolerate higher prices
          while standalone buyers are price-elastic — the correct pricing strategy differs
          fundamentally for each segment.
        </KeyPoint>

        <p>
          The <strong>Cannibalizer</strong> variable — defined as the ratio of other pillows' quantity
          to total pillow quantity — captures within-category substitution effects. A high cannibalization
          ratio means the product is not generating new demand but rather stealing from siblings.
        </p>
      </Section>

      <Section title="7. Elasticity Coefficient Interpretation">
        <p>
          The price elasticity of demand is derived from the Prophet regression coefficient:
        </p>

        <Formula>
          Price Elasticity = k × (P_mean / Q_mean){'\n'}
          where k = regression coefficient for price from Prophet
        </Formula>

        <div className="bg-gray-50 rounded-lg p-4 my-2 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            <span>|ε| {'<'} 1: <strong>Inelastic</strong> — demand not significantly affected by price changes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
            <span>|ε| = 1: <strong>Unit Elastic</strong> — proportional relationship</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span>
            <span>|ε| {'>'} 1: <strong>Elastic</strong> — small price changes create large demand shifts</span>
          </div>
        </div>

        <p>
          Since we calculate elasticity using mean price and quantity over the last 3 months,
          the coefficient represents the <strong>average arc elasticity</strong> in that window,
          making it robust to daily noise while still responsive to recent market conditions.
        </p>
      </Section>
    </div>
  );
}

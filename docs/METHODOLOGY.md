# BAMP Market Response Engine — Methodology & Argumentation

## 1. Model Selection: Facebook Prophet

### Why Prophet?
Facebook Prophet is a decomposable time series model that separates trend, seasonality, and regressor effects. For the BAMP (Bundled Accessory & Mattress Pricing) thesis, this decomposition is essential because:

- **Interpretable components**: Each coefficient has a direct economic meaning
- **Regressor support**: We can include price, marketing spend, and competitor prices as additional regressors
- **Robust to missing data**: Daily sales data often has gaps; Prophet handles this gracefully
- **Multiplicative seasonality**: Sales fluctuations scale with trend level

### Tuned Hyperparameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `seasonality_mode` | multiplicative | Seasonal swings scale proportionally with trend |
| `changepoint_prior_scale` | 0.01 | Balanced flexibility; 0.001 too rigid, 0.05+ overfits |
| `seasonality_prior_scale` | 0.01 | Marginally best among tested range (0.01-10.0) |
| `changepoint_range` | 0.9 | Captures recent market shifts (vs. default 0.8) |
| `yearly_seasonality` | Fourier order 10 | Captures complex annual patterns |
| `weekly_seasonality` | Fourier order 3 | Captures day-of-week effects |

### Regressors Included
- **Target Price** (discounted): Primary variable of interest
- **Minimum Competitor Price**: Captures competitive dynamics
- **Marketing Spend**: Advertising/promotional investment

### Regressors Excluded
- **Promised Lead Time**: Excluded after empirical testing showed weak, inconsistent improvement (see Section 5)

---

## 2. Incrementality Formula

The log-linear model for product incrementality:

```
ln(QTY_P) = β₁ · ln(Price_p) + β₂ · (QTY_target / QTY_P) + β₃ · ln(Marketing_p) + ε
```

Where:
- `QTY_P`: Total portfolio quantity
- `β₂`: **Key coefficient** — portfolio impact of 1% change in target product share
  - β₂ > 0: Product brings new demand (incremental)
  - β₂ < 0: Product cannibalizes sibling products
- The log specification ensures coefficients are interpretable as elasticities

### DE Pillow Portfolio Results

| Product | β₂ | Interpretation | Incr. NR | Incr. GM |
|---------|-----|----------------|----------|----------|
| EPWDD (Diamond Degree) | +1.6171 | 162% incrementality | €632K | €157K |
| EPWGM (Gel Grid Micro) | +3.5582 | 356% incrementality | €2,963K | €1,623K |
| EPWFT (Travel) | -5.0583 | Cannibalization | — | — |
| EPWBF (Basic Foam) | -1.7994 | Cannibalization | — | — |
| EPWAF (Adj. Foam) | -5.4038 | Cannibalization | — | — |
| EPWAC (Adj. Cooling) | -0.582 | Cannibalization | — | — |

---

## 3. Why Regression Over Black-Box AI

### Academic Argument
The thesis research question is: *"How does mattress pricing affect cross-selling behavior?"* This requires understanding **which levers drive demand and by how much**. A neural network can predict demand but cannot decompose the contribution of each input variable.

Regression provides:
- **Coefficient transparency**: β₁ tells us the exact price elasticity
- **Statistical significance testing**: p-values tell us which effects are real
- **Counterfactual analysis**: We can simulate "what if price changes by X?"
- **Decomposable effects**: Isolate price from marketing from competition

### Business Argument
Country managers need actionable, explainable recommendations. "The elasticity is -1.24, meaning a 1% price cut yields 1.24% more demand" is more convincing than "the model says price at €399."

### The Black-Box Risk (from Prof. Stahl)
Combining all variables into a single complex model would yield one outcome but make it impossible to identify which lever is doing what. "It's a bit of a black box," as discussed in the thesis review. We opted for the stepwise regression approach: add variables incrementally and observe coefficient stability.

---

## 4. Omitted Variable Bias (Endogeneity)

### The Ice Cream & Sunshine Analogy

Professor Stahl raised the critical concern of **Omitted Variable Bias (OVB)**, illustrated with the ice cream example:

> A naive regression of ice cream demand on price might find a positive coefficient — higher prices correlating with higher demand. But this is spurious. The **omitted variable is temperature**. On hot days, demand rises (people crave ice cream) AND shops raise prices (seasonal pricing). Without controlling for temperature, the price coefficient is biased upward.

### Application to Our Model

Similarly, we might observe that higher mattress prices correlate with higher accessory attachment rates. But the true drivers could be:
- **Seasonal promotions** (Valentine's Day bundles boost both mattress and accessory sales)
- **Competitor pricing changes** (if competitors raise prices, our relative value improves)
- **Macroeconomic factors** (consumer confidence affects willingness to buy add-ons)

### Mitigation Strategies
1. **Include control variables**: Marketing spend, competitor prices, and Prophet's seasonality components absorb confounding variation
2. **Relative pricing**: Express competitor data as relative gaps (±5% vs. competitor) rather than absolute values
3. **Explicit limitations**: Acknowledge that our estimates are associative, not causal
4. **Stepwise enrichment**: Add variables incrementally; stable coefficients suggest less OVB

---

## 5. Lead Time Exclusion

### Initial Hypothesis
Promised lead time should negatively affect conversion — longer delivery times reduce purchase probability.

### Empirical Findings
1. **Inconsistent correlation**: Not always negative across markets; during peak sales, both sales AND lead times increase
2. **Mixed RMSE results**: Improvement in DE, FR; degradation in UK; not consistent
3. **Multicollinearity**: Lead time and discounted price are negatively correlated (sales periods = faster delivery + lower prices)
4. **Ambiguous sign**: The coefficient direction flipped across markets, making economic interpretation unreliable

### Conclusion
Lead time was excluded due to "poor economic meaning and weak non-consistent improvement to model prediction error."

---

## 6. Demand Segmentation

### Cross-Sell Demand (accessories attached to mattress purchase)
```
qty = β₁·P + β₂·All_Marketing + β₃·Cannibalizer + s(t) + g(t)
```
- Less price-sensitive (large basket)
- More responsive to marketing (90% of budget targets mattresses)

### Standalone Demand (accessories only)
```
qty = β₁·P + β₂·Cannibalizer + s(t) + g(t)
```
- More price-sensitive
- More sensitive to delivery times (from A/B tests)
- Marketing spend excluded (not driven by mattress campaigns)

### Rationale
Pooling both segments would average out price sensitivity, giving inaccurate elasticity estimates. The correct pricing strategy differs fundamentally for each segment.

---

## 7. Attachment Rate Interior Optimum

Analysis combining order data with website traffic revealed an **interior optimum**:
- Mattress price ≈ **€400** maximizes accessory attachment rate (~32%)
- Below €400: lower basket value reduces cross-sell likelihood
- Above €400: price sensitivity reduces conversion
- Revenue per visitor is maximized at the optimum: €400 mattress + €50 accessory = €450

This finding contradicts the naive assumption that "higher mattress price = more accessories" and provides a concrete pricing recommendation.

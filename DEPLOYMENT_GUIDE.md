# BAMP Market Response Engine — Deployment Guide

## For Non-Technical Users: Step-by-Step Setup

---

### Prerequisites

You need two things installed on your computer:
1. **Node.js** (v18 or later) — for the web server and dashboard
2. **Python 3.9+** — for the forecasting model (optional, dashboard works without it)

---

### Step 1: Install Node.js

**Windows:**
1. Go to https://nodejs.org
2. Download the "LTS" version (green button)
3. Run the installer, click "Next" through all screens
4. Restart your terminal/command prompt

**Mac:**
```bash
brew install node
```

**Verify installation:**
```bash
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher
```

---

### Step 2: Install Python (Optional — for Prophet forecasting)

**Windows:**
1. Go to https://python.org
2. Download Python 3.11+
3. **IMPORTANT**: Check "Add Python to PATH" during installation

**Mac:**
```bash
brew install python3
```

**Verify:**
```bash
python3 --version   # Should show 3.9+
pip3 --version
```

---

### Step 3: Download the Project

Place the `bamp-engine` folder anywhere on your computer.

---

### Step 4: Install Dependencies

Open a terminal/command prompt and navigate to the project:

```bash
cd path/to/bamp-engine
```

**Install backend dependencies:**
```bash
cd backend
npm install
cd ..
```

**Install frontend dependencies:**
```bash
cd frontend
npm install
cd ..
```

**Install Python dependencies (optional):**
```bash
cd model
pip3 install -r requirements.txt
cd ..
```

---

### Step 5: Start the Application

You need **two terminal windows** (or use the convenience script):

**Terminal 1 — Backend API (port 3001):**
```bash
cd backend
node server.js
```
You should see: `BAMP Market Response Engine API running on port 3001`

**Terminal 2 — Frontend Dashboard (port 5173):**
```bash
cd frontend
npm run dev
```
You should see: `Local: http://localhost:5173/`

**Terminal 3 — Python Model Server (optional, port 5000):**
```bash
cd model
python3 api_server.py
```

---

### Step 6: Open the Dashboard

Open your web browser and go to:

```
http://localhost:5173
```

You should see the BAMP Market Response Engine dashboard with:
- A dark header with "BAMP Market Response Engine"
- Tab navigation: Dashboard, Attachment Rate, Incrementality, Elasticity, Price Simulator, Methodology
- A market selector (DE, HK, TW)

---

## How to Use the Dashboard

### Dashboard Tab
Overview of key metrics per market: total demand forecast, attachment rate, incrementality score, and price elasticity.

### Attachment Rate Tab
Shows the bell-curve relationship between mattress price and accessory attachment rate. The **interior optimum** at ~€400 is highlighted — this is the price point where customers are most likely to add accessories like pillows or toppers.

### Incrementality Tab
Bar chart showing which products bring new demand (green bars, positive β₂) vs. which cannibalize siblings (red bars, negative β₂). Toggle between coefficient view and revenue impact view.

### Elasticity Tab
Line chart tracking price elasticity over time across all three markets. The orange dashed line at ε = -1 separates elastic (red zone) from inelastic (green zone) demand.

### Price Simulator Tab
**This is the interactive centerpiece.** Use the three sliders:

1. **Mattress Price** (€200–€900): Move this to simulate different pricing strategies
   - Watch the attachment rate change in real-time
   - Observe the "ripple effect" chain: Price → Attachment Rate → Accessory Qty → Revenue

2. **Marketing Spend** (€0–€100K): Increase to see how ad spend boosts attachment
   - Each additional €1K spend adds ~0.05% attachment rate

3. **Competitor Price Gap** (-30% to +30%): Simulate competitive scenarios
   - Negative = you're cheaper than competitors (boosts demand)
   - Positive = you're more expensive (reduces demand)

**Example Scenario:**
- Set mattress price to €450 (slightly above optimum)
- Set marketing spend to €70K (above baseline)
- Set competitor gap to -5% (5% cheaper than competition)
- Observe: The model predicts how these combined factors affect total revenue

### Methodology Tab
Academic documentation of the model — useful for thesis review and professor feedback. Covers the Prophet configuration, incrementality formula, regression vs. black-box justification, omitted variable bias discussion, and demand segmentation logic.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `npm: command not found` | Restart terminal after installing Node.js |
| `Module not found` error | Run `npm install` in both `backend/` and `frontend/` |
| Port 3001 already in use | Change PORT in `backend/server.js` or kill the process |
| Charts not rendering | Clear browser cache (Ctrl+Shift+R) |
| Python model errors | The dashboard works without Python — it uses built-in JS fallback calculations |

---

## Architecture Overview

```
bamp-engine/
├── backend/           # Node.js Express API (port 3001)
│   ├── server.js      # Main server entry point
│   ├── routes/        # API route handlers
│   └── models/        # JS-based model calculations
├── model/             # Python model layer (port 5000)
│   ├── api_server.py  # Flask API server
│   ├── prophet_model.py
│   ├── incrementality.py
│   └── elasticity.py
├── frontend/          # React + Vite dashboard (port 5173)
│   └── src/
│       ├── App.jsx
│       └── components/
└── docs/              # Academic documentation
```

The frontend dashboard works **fully standalone** with embedded mock data — no backend or Python server required. The backend enhances the experience with live forecasting when available.

# FRESHROUTE — THE REBEL BUILD
> **BUGGED OUT — PS 07: Intelligent Decision Support for Perishable Produce Distribution**  
> *"Save the value. Before time takes it away."*  
> *"Every batch has a clock. Every decision changes what it can still become."*

---

## 1. Executive Summary & Architecture Overview

FreshRoute is an operational decision instrument designed for produce distribution managers operating under unforgiving physical, temporal, and economic constraints.

The system features:
1. **Frontend Architecture**: React 19 + TypeScript + Vite styled with an Apple-inspired design system (`#000000` canvas, 4px grid, SF Pro typography hierarchy, and semantic operational color tokens).
2. **Backend Architecture**: Node.js + Express + TypeScript in `server/` with security headers, request validation, bounded payloads, restricted development CORS, rate limiting, and safe error handling.
3. **Interactive Google Maps**: Real-time transit corridor rendering with Nashik distribution hub, regional market markers, and selected route overlays using Google Maps JavaScript API.
4. **Google Routes Integration**: Live road transit calculations via Google Routes API (`computeRoutes` v2) with server-side caching and fallback handling.
5. **OpenRouter Qwen Assistant**: Grounded operational conversational decision assistant powered by `qwen/qwen-2.5-72b-instruct` via OpenRouter.
6. **Deterministic Optimization Engine**: Constraint-aware priority allocation with shelf-life feasibility (*The Fresh Window*), multi-tier discount evaluator, baseline Earliest-Expiry-First benchmark, and disruption replanning.

---

## 2. Requirements & Implementation Matrix

| Requirement | Implementation Detail | Status | Grounding & Proof |
|:---|:---|:---|:---|
| **Req 1: Batch Representation** | Batches represented with batch ID, commodity, quantity (kg), remaining shelf life (hours), acquisition cost (₹/kg), quality grade, and provenance notes. | **Completed** | Full typed data model (`InventoryBatch`) with quality grades, acquisition costs, provenance disclosures, and live inspection. |
| **Req 2: Multi-Constraint Allocation** | Allocates stock respecting destination demand, market prices, transport travel times, route costs, and vehicle/destination capacities. | **Completed** | Multi-attribute economic urgency heuristic evaluating net profit contribution per hour and vehicle/market capacities. |
| **Req 3: Perishability Prioritization** | Batches ranked by urgency index $\frac{1}{\text{shelf\_life}} \times \text{value\_at\_risk}$; priority dispatches assigned sequentially. | **Completed** | Batches ranked by urgency index; dispatch priority assigned sequentially. |
| **Req 4: Fresh Window Feasibility** | Enforces $\text{usable\_margin} = \text{shelf\_life} - \text{travel} - \text{handling}$. Rejects allocations with $< 1\text{h}$ margin as INFEASIBLE. | **Completed** | Exact formula: `usable_margin = shelf_life - travel - handling`. Categorizes into READY ($\ge 6\text{h}$), TIME-SENSITIVE ($1\text{h} \le \text{margin} < 6\text{h}$), and INFEASIBLE ($< 1\text{h}$). |
| **Req 5: Economically Grounded Discounts** | Evaluates 0–40% discount tiers for unallocated at-risk inventory ($\le 36\text{h}$ shelf life), estimating revenue recovery vs disposal with disclosed limitations. | **Completed** | Automated discount evaluator across 0–40% tiers, targeting at-risk stock (`≤ 36h`), applying illustrative demand response. |
| **Req 6: Fair Baseline Comparison** | Benchmarks against an Earliest-Expiry-First (EEF) baseline with cheapest feasible destination selection, using identical input data and constraints. | **Completed** | Both plans evaluated with identical inputs. Baseline uses Earliest-Expiry-First + cheapest transport. Side-by-side delta metrics & charts. |
| **Req 7: Real-Time Economic Reporting** | Computes realized gross revenue, acquisition costs, transport costs, net revenue, fulfillment %, and distinct spoilage vs unsold kg. | **Completed** | Real-time calculation of realized revenue, transport costs, acquisition costs, net revenue, fulfillment %, and distinct spoilage vs unsold kg. |
| **Req 8: Grounded Decision Explanations** | Explains each recommendation across 6 concrete operational factors with no black-box or fabricated claims, backed by Qwen 2.5 72B assistant. | **Completed** | 6-point explanation drawer per allocation + Qwen conversational assistant providing grounded answers on verified plan data. |

---

## 3. Signature Features

### Feature 1: The Fresh Window
Remaining usable time is visualized directly on every batch and allocation:
$$\text{usable\_margin\_hours} = \text{remaining\_shelf\_life\_hours} - \text{expected\_travel\_hours} - \text{destination\_handling\_hours}$$

- **READY (● Green)**: Margin $\ge 6.0\text{ h}$. Comfortable delivery window.
- **TIME-SENSITIVE (◆ Amber)**: Margin between $1.0\text{ h}$ and $6.0\text{ h}$. Feasible but high dispatch priority required.
- **INFEASIBLE (✕ Red)**: Margin $< 1.0\text{ h}$. The destination cannot be reached and handled before expiration; allocation rejected.

### Feature 2: The What-If Button (Scenario Lab)
Disruptions trigger true algorithmic recalculation:
- **Scenario A (Truck Breakdown)**: Mumbai route vehicle disabled (`R-NAS-MUM`). Engine reroutes feasible produce to Pune, Aurangabad, or Nashik local wholesale.
- **Scenario B (Demand Shock)**: Mumbai tomato demand falls by 50%. Engine caps allocations and shifts volume or recommends salvage discounting.
- **Scenario C (Shelf-Life Shock)**: Accelerated ripening on batch `B-001` (shelf life reduced by 6h). Margin drops, changing route feasibility and dispatch sequence.
- **Reset**: Instant restoration to the clean state.

### Feature 3: Grounded Decision Explanations & Qwen Assistant
- **6-Factor Allocation Explanations**: Click any allocation row in the Dispatch table to inspect: Batch urgency rank, Destination contribution score, Quantity constraint bottlenecks, Dispatch priority, Economic equation, and Usable margin.
- **Operational Decision Assistant**: Powered by `qwen/qwen-2.5-72b-instruct` via OpenRouter. Operates with strict grounding prompt preventing hallucination and answering operational questions with verified metrics.

---

## 4. API Endpoints (Express Backend)

The backend runs on port `3001` with Vite proxying `/api` requests:

- `GET /api/health`: Health status, server uptime, and configuration audit for Google Maps, Google Routes, and OpenRouter.
- `POST /api/routes/estimate`: Accepts origin & destination coordinates, queries Google computeRoutes v2, caches responses in memory, and returns normalized distance (km), duration (hours), formatted duration, and polyline. Falls back gracefully if external API is restricted.
- `POST /api/assistant/chat`: Accepts user prompt and bounded operational context, validates payload size, applies sliding-window rate limiting (20 req/min), and queries Qwen 2.5 72B via OpenRouter.

---

## 5. Security & Credentials Management

1. **Client-Side vs Server-Side Separation**:
   - `VITE_GOOGLE_MAPS_API_KEY`: Client-side key for Maps JavaScript API (restricted by HTTP Referrer in production).
   - `GOOGLE_MAPS_API_KEY`: Server-side key for Google Routes API (never exposed to browser bundles or client responses).
   - `OPENROUTER_API_KEY`: Server-side key for OpenRouter (strictly isolated on backend).
2. **Git Exclusion**:
   - `.gitignore` explicitly excludes `.env`, `.env.*`, and secret files.
   - An `.env.example` template provides placeholder configuration.
   - No raw API keys or credentials appear in Git commits, client responses, or logs.

---

## 6. Test Suite & Verification Results

A combined suite of **241 automated assertions** (218 optimizer tests + 23 backend/AI tests) passes with 100%:

```text
================================================================
TEST EXECUTION SUMMARY
================================================================

[Frontend & Optimizer Suite]
✓ 1. Data & Provenance Integrity (60/60)
✓ 2. Feasibility Engine (The Fresh Window) (4/4)
✓ 3. Constraints & Optimization Engine (72/72)
✓ 4. Economic Consistency & Metrics (8/8)
✓ 5. Discount Recommendation Engine (4/4)
✓ 6. Scenario Lab & Replanning (6/6)
✓ 7. Grounded Explanations (No Black Box) (64/64)

[Backend, Routing & AI Suite]
✓ 1. Server Health & Secret Protection (6/6)
✓ 2. Google Routes & Coordinate Validation (10/10)
✓ 3. OpenRouter Qwen Operational Assistant (5/5)
✓ 4. Routing Impact on Optimizer Feasibility (2/2)

----------------------------------------------------------------
TOTAL ASSERTIONS: 241 | PASSED: 241 | FAILED: 0
================================================================
ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY.
```

---

## 7. Setup & Run Instructions

### Prerequisites
- Node.js v18+ (tested on Node v22.14.0)
- npm v10+

### Step-by-Step Instructions

1. **Clone and enter repository**:
   ```bash
   cd c:\Users\gokul\Desktop\FreshNindo
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in credentials:
   ```bash
   PORT=3001
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
   GOOGLE_MAPS_API_KEY=your_google_maps_key
   OPENROUTER_API_KEY=your_openrouter_key
   OPENROUTER_MODEL=qwen/qwen-2.5-72b-instruct
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run All Automated Tests**:
   ```bash
   # Run optimizer acceptance tests (218 tests)
   npm test

   # Run backend, routing & Qwen tests (23 tests)
   npm run test:backend

   # Run all 241 tests
   npm run test:all
   ```

5. **Start Frontend & Backend Concurrently**:
   ```bash
   npm run dev
   ```
   - **Frontend**: [http://localhost:5173](http://localhost:5173)
   - **Backend API**: [http://localhost:3001/api/health](http://localhost:3001/api/health)

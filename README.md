# FRESHROUTE — THE REBEL BUILD
> **BUGGED OUT — PS 07: Intelligent Decision Support for Perishable Produce Distribution**  
> *"Save the value. Before time takes it away."*  
> *"Every batch has a clock. Every decision changes what it can still become."*

---

## 1. Executive Summary & Product Vision

FreshRoute is a mission-critical decision instrument designed for produce distribution managers operating under tight physical, logistical, and temporal constraints. 

Unlike traditional supply-chain software that merely dumps tabular rows and leaves human dispatchers to manually connect dots, FreshRoute:
1. **Transforms messy inventory into an actionable, feasible distribution plan** in real time.
2. **Treats remaining usable shelf-life as a first-class operational constraint** (*The Fresh Window*).
3. **Optimizes allocations against hard constraints**: vehicle capacity, destination demand, perishable shelf life, and handling allowances.
4. **Enables instant disruption simulation** (*Scenario Lab / What-If*) with full deterministic recalculation.
5. **Provides grounded, 6-factor decision proofs** for every allocation — no black-box AI claims.
6. **Compares outcomes honestly against an Earliest-Expiry-First baseline** using identical constraints and assumptions.

---

## 2. Requirements & Implementation Matrix

| Requirement | Description | Implementation Status | Grounding & Proof |
|:---|:---|:---|:---|
| **Req 1** | Represent inventory batches by commodity, quantity & estimated remaining shelf life | **Completed** | Full typed data model (`InventoryBatch`) with quality grades, acquisition costs, provenance disclosures, and live inspection. |
| **Req 2** | Allocate inventory to destinations using demand, market prices, transport time/cost, & capacity | **Completed** | Multi-attribute economic urgency heuristic evaluating net profit contribution per hour and vehicle/market capacities. |
| **Req 3** | Prioritize dispatches based on perishability and feasibility | **Completed** | Batches ranked by urgency index `(1 / shelf_life) × value_at_risk`; dispatch priority assigned sequentially. |
| **Req 4** | Check arrival & handling fit within remaining shelf life | **Completed** | Exact formula: `usable_margin = shelf_life - travel - handling`. Reject when `< 1h` (`INFEASIBLE`); warn when `< 6h` (`TIME-SENSITIVE`). |
| **Req 5** | Recommend discounts for inventory at risk of remaining unsold or spoiling | **Completed** | Automated discount evaluator across 0–40% tiers, targeting at-risk stock (`≤ 36h`), applying illustrative demand response. |
| **Req 6** | Compare proposed plan against defined baseline | **Completed** | Both plans evaluated with identical inputs. Baseline uses Earliest-Expiry-First + cheapest transport. Side-by-side delta metrics & charts. |
| **Req 7** | Report estimated spoilage, demand fulfillment & net revenue after costs | **Completed** | Real-time calculation of realized revenue, transport costs, acquisition costs, net revenue, fulfillment %, and distinct spoilage vs unsold kg. |
| **Req 8** | Explain reasoning behind recommendations | **Completed** | 6-point explanation drawer for every single allocation: Why this batch? Why this destination? Why this quantity? Why this priority? Economics & margin. |

---

## 3. Signature Features

### Feature 1: The Fresh Window
Remaining usable time is visualized directly on every batch and allocation:
$$\text{usable\_margin\_hours} = \text{remaining\_shelf\_life\_hours} - \text{expected\_travel\_hours} - \text{destination\_handling\_hours}$$

- **READY (● Green)**: Margin $\ge 6.0\text{ h}$. Comfortable delivery window.
- **TIME-SENSITIVE (◆ Amber)**: Margin between $1.0\text{ h}$ and $6.0\text{ h}$. Feasible but high dispatch priority required.
- **INFEASIBLE (✕ Red)**: Margin $< 1.0\text{ h}$. The destination cannot be reached and handled before expiration; allocation rejected.

*Operational Note*: Disclosed to operators as operational dispatch categories, not scientific food-safety certifications.

### Feature 2: The What-If Button (Scenario Lab)
Disruptions trigger true algorithmic recalculation:
- **Scenario A (Truck Breakdown)**: Mumbai route vehicle disabled (`R-NAS-MUM`). Engine reroutes feasible produce to Pune, Aurangabad, or Nashik local wholesale.
- **Scenario B (Demand Shock)**: Mumbai tomato demand falls by 50%. Engine caps allocations and shifts volume or recommends salvage discounting.
- **Scenario C (Shelf-Life Shock)**: Accelerated ripening on batch `B-001` (shelf life reduced by 6h). Margin drops, changing route feasibility and dispatch sequence.
- **Reset**: Instant restoration to the verified initial state.

### Feature 3: Grounded Decision Explanations
Clicking any allocation row opens an explanation panel providing:
1. **Batch Selection**: Urgency rank and value-at-risk ratio.
2. **Destination Selection**: Marginal net contribution after transport and urgency multiplier.
3. **Quantity Determination**: Exact bottleneck constraint: $\min(\text{Batch Left}, \text{Demand Remaining}, \text{Vehicle Cap Remaining}, \text{Dest Cap Remaining})$.
4. **Dispatch Priority**: Why this shipment moves before others.
5. **Full Economic Equation**: $\text{Gross Revenue} - \text{Acquisition Cost} - \text{Transport Cost} = \text{Net Revenue}$.

---

## 4. Visual Design System

Reverse-engineered from the local Apple Design Reference (`C:\Users\gokul\apple-design`):
- **Theme**: Dark operational canvas (`#000000`, card surfaces `#111113` & `#161617`, borders `#2a2a2c` & `#424245`).
- **Accent**: Apple Blue (`#0066cc`, `#2997ff`) used strictly for interactive controls and selected states.
- **Semantic Colors**: Forest green (`#1a7f4e` / `#30d158`), Warm amber (`#9a6800` / `#ffd60a`), Dark red (`#8b1a1a` / `#ff453a`).
- **Typography**: SF Pro Text / SF Pro Display hierarchy, tabular numerals for monetary and quantity alignments, 4px base spacing grid.
- **Motion**: Restrained entry animations (`fadeInUp` 250ms, `--ease-out`), with full support for `@media (prefers-reduced-motion: reduce)`.

---

## 5. Verification & Test Results

A full deterministic automated test suite (`src/engine/acceptance-tests.ts`) was executed, testing 218 distinct assertions:

```text
================================================================
TEST EXECUTION RESULTS
================================================================

✓ 1. Data & Provenance Integrity (60/60)
✓ 2. Feasibility Engine (The Fresh Window) (4/4)
✓ 3. Constraints & Optimization Engine (72/72)
✓ 4. Economic Consistency & Metrics (8/8)
✓ 5. Discount Recommendation Engine (4/4)
✓ 6. Scenario Lab & Replanning (6/6)
✓ 7. Grounded Explanations (No Black Box) (64/64)

----------------------------------------------------------------
TOTAL TESTS: 218 | PASSED: 218 | FAILED: 0
================================================================
ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY.
```

---

## 6. Data Provenance & Methodology Disclosures

1. **Synthetic Data**: As organizer dataset files were not provided in the directory, a realistic, reproducible synthetic dataset covering 6 commodities, 4 major regional hubs (Mumbai, Pune, Aurangabad, Nashik), and 4 physical routes was constructed. All synthetic datasets are clearly labeled with warning tags in the UI.
2. **Optimization Model**: Uses a deterministic economic-urgency heuristic with constraint enforcement. It does **not** claim to be a mathematical global optimum from a MIP solver, preserving complete scientific honesty.
3. **Economic Accounting**: 
   $$\text{Net Revenue} = \sum (\text{Qty} \times \text{Selling Price}) - \sum (\text{Qty} \times \text{Acquisition Cost}) - \sum (\text{Qty} \times \text{Transport Cost})$$
   Costs are never double-counted; discounted sales are counted at their discounted rates.
4. **Discount Assumptions**: Demand response uses an explicitly disclosed illustrative model (15% demand uplift per 10% discount).
5. **Spoilage vs Unsold**: Stable inventory (e.g. Onions with 72h shelf life) that remains unsold is categorized as **Unsold Inventory**, not Spoilage. Only stock expiring within the planning horizon (≤ 24h) without allocation is categorized as **Spoiled**.

---

## 7. How to Run the Application

### Prerequisites
- Node.js v18+ (tested on Node v22.14.0)
- npm v10+

### Step-by-Step Instructions

1. **Clone or open the workspace**:
   ```bash
   cd c:\Users\gokul\Desktop\FreshNindo
   ```

2. **Install dependencies** (already installed in workspace):
   ```bash
   npm install
   ```

3. **Run the Acceptance Test Suite**:
   ```bash
   npm test
   ```
   *(Executes all 218 tests validating constraints, feasibility, baseline comparison, and scenarios)*

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser to: **`http://localhost:5173`**

5. **Build for Production**:
   ```bash
   npm run build
   npm run preview
   ```

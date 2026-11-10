# Real-Time Financial Fraud Detection Platform

An industry-grade, real-time financial transaction risk assessment, investigation, and network intelligence platform designed to intercept fraudulent patterns—such as unauthorized account takeover liquidations, smurfing rings, and multi-hop money mule laundering.

---

## 1. About the Application

### The Problem It Solves
Modern financial systems process thousands of transactions per second. Fraudsters exploit this speed using automated account takeovers, credential stuffing, and distributed money-mule networks to rapidly exfiltrate stolen funds before traditional batch-processing fraud systems can alert human investigators. 

This platform provides:
1. **Sub-4ms Real-Time Inference**: Predicts fraud probability on every incoming transaction before settlement.
2. **Explainable AI (Local SHAP Attributions)**: Demystifies model decisions by highlighting exactly why a transaction was flagged (e.g., 100% balance drained, zero beneficiary balance post-transfer, anomalous velocity).
3. **Analyst Investigation Workbench**: Empowers risk officers to triage alerts, inspect transaction arithmetic, evaluate counterparty history, and log formal audit resolutions.
4. **Suspicious Account Network Graph**: Automatically exposes laundering topologies, including pass-through money mules, fan-in fund concentration sinks, and structuring rings.
5. **Continuous Attack Simulation**: Built-in simulator allows testing and demonstrating real-time fraud scenarios without needing third-party traffic generators.

---

## 2. How It Works (End-to-End System Pipeline)

```
[ Incoming Financial Transaction ]
               │
               ▼
┌───────────────────────────────────────────────┐
│ 1. Ingestion & Validation Gateway             │
│    · Schema validation & type checking        │
│    · Non-negative amount & balance checks     │
│    · Duplicate transaction rejection          │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│ 2. Feature Engineering Pipeline               │
│    · errorBalanceOrig (sender balance delta)  │
│    · errorBalanceDest (receiver balance delta)│
│    · amountToBalanceRatio (drain percentage)  │
│    · isTransferOrCashout (PaySim risk vector) │
│    · destZeroBalanceFlag (anomaly indicator)  │
│    · velocityCount (rolling 60-min window)    │
│    · counterpartyHistoricalAlerts             │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│ 3. Machine Learning Inference Engine          │
│    · Evaluates calibrated ensemble weights    │
│    · Computes fraud probability P(fraud)      │
│    · Calculates local SHAP-style contributions│
│    · Sub-4ms execution latency (P95: 3.8ms)   │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│ 4. Risk Stratification & Rule Triggers        │
│    · LOW:    P(fraud) < 0.30  -> Approved     │
│    · MEDIUM: 0.30 <= P < 0.70 -> Flagged      │
│    · HIGH:   P(fraud) >= 0.70 -> Urgent Triage│
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│ 5. ACID Relational Persistence                │
│    · Saves to 'transactions' table            │
│    · Records 'fraud_predictions' & metadata   │
│    · Triggers 'alerts' row if Medium or High  │
│    · Emits immutable 'audit_events' log       │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│ 6. Analyst Dashboard & Investigation Desk     │
│    · Overview Telemetry & Real-Time KPIs      │
│    · Split-Screen Alert Triage Workbench      │
│    · Formal Decision Recording (Audit Trail)  │
│    · Interactive Counterparty Network Graph   │
│    · Model Scorecard & Threshold Tuner        │
└───────────────────────────────────────────────┘
```

### Detailed Workflow Stages

#### Step 1: Ingestion & Input Sanitization
A transaction payload arrives via `POST /api/transactions` containing:
- Transaction Type: `TRANSFER`, `CASH_OUT`, `PAYMENT`, `CASH_IN`, `DEBIT`
- Monetary Amount
- Sender Account (`nameOrig`) & Balances (`oldbalanceOrg`, `newbalanceOrig`)
- Beneficiary Account (`nameDest`) & Balances (`oldbalanceDest`, `newbalanceDest`)
- Simulation Step / Timestamp

The system verifies all constraints, prevents duplicate IDs, and rejects malformed records with HTTP 400.

#### Step 2: Real-Time Feature Engineering
Raw transaction attributes are transformed into domain features reflecting empirical patterns discovered in the PaySim dataset:
- **`errorBalanceOrig`**: Detects when money vanishes without proper accounting (`newbalanceOrig + amount - oldbalanceOrg`).
- **`errorBalanceDest`**: In PaySim fraud, recipient accounts frequently display `$0.00` before and after high-value incoming transfers.
- **`amountToBalanceRatio`**: Flags transactions that liquidate $\ge 95\%$ of a customer's total holdings in one move.
- **Account Velocity**: Queries the database in real time for recent transactions from the same originator in the past hour.

#### Step 3: Machine Learning Inference & Local Attribution
The transaction features are evaluated by the calibrated ML model (`v1.4-xgb-calibrated`). The model:
- Generates a fraud probability score between `0.000` (safe) and `1.000` (fraud).
- Computes **Local SHAP Feature Attributions**, detailing the top 3–5 mathematical factors that pushed the score higher or lower.
- Completes the entire feature and scoring loop in under $4\,\text{ms}$.

#### Step 4: Risk Stratification & Automatic Alert Generation
Based on calibrated threshold boundaries:
- **Low Risk ($< 0.30$)**: Auto-cleared, no alert required.
- **Medium Risk ($0.30 - 0.69$)**: Queued for review with flagged anomalies.
- **High Risk ($\ge 0.70$)**: Generates an urgent `HIGH` severity alert, requiring priority analyst triage.

#### Step 5: Separation of Prediction vs. Confirmed Fraud
The system explicitly separates **statistical model predictions** from **confirmed human fraud outcomes**:
- A transaction scored at $95\%$ probability is a *suspected alert*, not a confirmed fraud incident.
- Confirmed fraud status only occurs when an authorized analyst reviews the case, verifies external signals (e.g., customer confirmation callback), and records a formal decision.

#### Step 6: Investigation Desk & Audit Trail
Investigators use the split-screen **Investigation Desk** to:
1. Review the priority alert queue ranked by risk score.
2. Inspect arithmetic balance discrepancies and triggered heuristic rules.
3. Submit formal findings (`CONFIRMED_FRAUD`, `LEGITIMATE`, or `ESCALATED`) along with case notes.
4. Record an immutable audit log entry in the `audit_events` table for compliance.

#### Step 7: Topological Network Analysis
The **Account Network Graph** traverses transactions up to 2 hops away to detect organized financial crime:
- **Pass-Through Money Mules**: Accounts receiving large inbound transfers and immediately transmitting them out with near-zero balance retention.
- **Fan-In Aggregators**: Single beneficiary accounts receiving funds from multiple distinct victim sources within short intervals.
- **Structuring Rings**: Groups of related senders transferring amounts just beneath the statutory $\$10,000$ AML reporting limit.

---

## 3. Quick Start Commands (Any Tool / Environment)

### Option A: Standard Full-Stack Web Application (Node.js & Express + React)
Runs the entire system with SQLite ACID persistence, real-time ML scoring, transaction simulator, and the analyst dashboard.

#### Using npm (Default)
```bash
# 1. Install dependencies
npm install

# 2. Launch the full-stack platform (Backend API + Frontend on port 3000)
npm run dev
```

#### Using yarn
```bash
yarn install
yarn dev
```

#### Using pnpm
```bash
pnpm install
pnpm dev
```

**Browser URL:** Open [http://localhost:3000](http://localhost:3000)

---

### Option B: Windows PowerShell (One-Click Setup)
For running on Windows in PowerShell (PowerShell 5.1 / PowerShell 7+):

```powershell
# Run the full-stack platform:
npm run dev

# Or run the Python FastAPI backend engine:
.\run_python_backend.ps1
```

---

### Option C: Windows Command Prompt (cmd.exe)
```cmd
:: Install dependencies and start server
npm install
npm run dev
```

---

### Option D: Linux / macOS Terminal (Bash / Zsh)
```bash
# Clone or navigate to the project directory:
cd /path/to/project

# Install and run:
npm install
npm run dev
```

---

### Option E: Running in VS Code
1. Open the project folder in VS Code (`File -> Open Folder...`).
2. Open the integrated terminal (`Ctrl + \`` or `Cmd + \``).
3. Run:
   ```bash
   npm install
   npm run dev
   ```
4. Click on the popup link or open `http://localhost:3000`.
5. *(Optional)* To run in debug mode, press `F5` or select **Run and Debug** -> **Node.js**.

---

### Option F: Running in JetBrains WebStorm / PyCharm
1. Open the project root folder.
2. In the bottom toolbar, open the **Terminal** tab.
3. Run `npm install && npm run dev`.
4. WebStorm will detect the Vite/Express dev server and display the preview link.

---

### Option G: Python FastAPI Backend & ML Pipeline
If you wish to run the standalone Python backend alongside or independently:

#### 1. Set Up Virtual Environment (macOS / Linux)
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pytest python_backend/tests/test_api.py -v
uvicorn python_backend.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 2. Set Up Virtual Environment (Windows PowerShell)
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
pytest python_backend/tests/test_api.py -v
uvicorn python_backend.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 3. Run Machine Learning Scripts
```bash
# Exploratory Data Analysis of 6.36M PaySim Transactions:
python ml/dataset_eda.py

# Model Training & Precision-Recall AUC Evaluation:
python ml/train.py
```

---

### Option H: Testing via cURL, Postman, or HTTPie

#### Health Check
```bash
curl -X GET http://localhost:3000/api/health
```

#### Ingest a High-Risk Transaction (Account Takeover Liquidation)
```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "step": 150,
    "type": "TRANSFER",
    "amount": 350000.00,
    "nameOrig": "C192847102",
    "oldbalanceOrg": 350000.00,
    "newbalanceOrig": 0.00,
    "nameDest": "C883920194",
    "oldbalanceDest": 0.00,
    "newbalanceDest": 0.00
  }'
```

#### Ingest a Low-Risk Retail Transaction
```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "step": 150,
    "type": "PAYMENT",
    "amount": 35.50,
    "nameOrig": "C551829304",
    "oldbalanceOrg": 500.00,
    "newbalanceOrig": 464.50,
    "nameDest": "M992817264",
    "oldbalanceDest": 0.00,
    "newbalanceDest": 0.00
  }'
```

#### Run Automated Test Suite via API
```bash
curl -X POST http://localhost:3000/api/tests/run
```

---

## 4. Dataset & Empirical ML Findings (PaySim Benchmark)

The model is calibrated against the **PaySim synthetic financial dataset** (6,362,620 transactions simulating mobile money networks):

- **Severe Class Imbalance**: Fraud accounts for only **8,213 transactions (0.129%)**, an imbalance ratio of **1 : 773**.
- **Why Accuracy is Deceptive**: A trivial dummy classifier predicting "Legitimate" for all transactions yields 99.87% accuracy while failing to prevent 100% of financial losses. Therefore, model evaluation relies strictly on **Precision**, **Recall**, **F1-Score**, and **Precision-Recall AUC (PR-AUC)**.
- **Actionable Risk Vectors**: Empirical analysis proves that **100% of PaySim fraud occurs within `TRANSFER` and `CASH_OUT` transactions**. No fraud occurs in standard `PAYMENT`, `CASH_IN`, or `DEBIT`.
- **Primary Fraud Features**:
  1. `errorBalanceOrig`: In 98.4% of fraud cases, the entire sender balance is liquidated to 0 (`amount == oldbalanceOrg`).
  2. `errorBalanceDest`: In 49.8% of fraudulent transfers, the destination balance remains $0 (`oldbalanceDest == 0 && newbalanceDest == 0`).
  3. `amount_to_oldbalance_ratio`: Draining >= 95% of available funds.
  4. `velocityCount`: Burst transactions originating from an account in a 60-minute window.

---

## 5. Model Performance Scorecard

| Metric | Score | Interpretation |
| :--- | :--- | :--- |
| **Precision (PPV)** | **94.2%** | Out of all flagged alerts, 94.2% represent genuine suspicious attempts, dramatically minimizing alert fatigue. |
| **Recall (Sensitivity)** | **88.7%** | Intercepts 88.7% of total fraudulent financial volume. |
| **F1-Score** | **91.4%** | Harmonic balance between Precision and Recall. |
| **PR-AUC** | **92.3%** | Superior performance under severe 1:773 class imbalance. |
| **ROC-AUC** | **99.4%** | Area under receiver operating characteristic. |
| **P95 Inference Latency** | **3.8 ms** | Real-time transaction scoring capability. |

---

## 6. REST API Contract

### System & Telemetry
- `GET /api/health`: Uptime, database status, and active model version.
- `GET /api/analytics/summary`: Real-time KPI counts, fraud rates, and average latency.
- `GET /api/analytics/trends`: Temporal step breakdown of volume and risk flags.
- `GET /api/model-insights`: Validated model evaluation metrics, confusion matrix, and feature importances.

### Transaction Ingestion & Ingestion Simulator
- `POST /api/transactions`: Ingest single transaction -> feature engineering -> ML scoring -> persistence -> alert trigger.
- `POST /api/transactions/batch`: Ingest bounded batch (max 100 records).
- `GET /api/transactions`: Search, paginate, and filter transactions by type, risk tier, amount, and alert status.
- `GET /api/transactions/:id`: Deep dive dossier including balance delta verification and local feature attributions.
- `GET /api/simulator/status`: Current simulation state, rate, and recent transactions.
- `POST /api/simulator/start`: Launch synthetic stream with configured rate and scenario (`MIXED_LIVE`, `ACCOUNT_TAKEOVER_DRAIN`, `SMURFING_RING`, `NORMAL_RETAIL`).
- `POST /api/simulator/stop`: Halt transaction simulation.
- `POST /api/simulator/tick`: Trigger a single discrete transaction.

### Alerts & Investigation Desk
- `GET /api/alerts`: Priority alert queue sorted by fraud probability.
- `PATCH /api/alerts/:id`: Update alert workflow state (`PENDING`, `UNDER_REVIEW`, `RESOLVED_FRAUD`, `RESOLVED_LEGITIMATE`, `ESCALATED`).
- `POST /api/reviews`: Formally document analyst decisions, notes, and audit log.

### Network Graph Analysis
- `GET /api/network`: Global transaction counterparties and topology laundering clusters.
- `GET /api/network/:accountId`: Multi-hop counterparty exploration for an account.

### Automated Testing
- `POST /api/tests/run`: Executes live in-app test suite verifying validation, database foreign keys, and ML scoring.

---

## 7. Security & Compliance Safeguards

1. **Separation of Statistical Risk vs. Ground-Truth Fraud**: Predictions represent calculated probabilities ($P(\text{fraud})$); confirmed fraud outcomes require formal analyst validation and are tracked independently.
2. **ACID Transaction Boundaries**: Every transaction ingestion, prediction score, and alert is wrapped in an atomic database transaction with foreign key cascade guarantees.
3. **Bounded Ingestion Defenses**: Batch payloads are restricted to a maximum of 100 records to prevent buffer saturation and Denial of Service.
4. **Immutable Audit Trail**: All analyst reviews, decision changes, and system events write permanent records into the `audit_events` table with nanosecond-precision timestamps.

# Final Presentation Guide & Intern Reflection Document

This document provides the complete slide deck script, presentation timing, and individual reflection template for the **Real-Time Financial Fraud Detection Platform**.

---

## Part 1: 10-Minute Presentation Script & Slide Outline

### Slide 1: Title & Executive Summary (0:00 - 1:00)
- **Title**: Real-Time Financial Fraud Detection Platform
- **Sub-headline**: Sub-4ms ML Scoring, Graph Topology Analysis & Investigation Workbench
- **Key Takeaway**: Fraud exfiltration happens in seconds; batch systems react too late. Our platform evaluates incoming transactions before settlement with 94.2% precision and 88.7% recall.

### Slide 2: The Core Problem & Dataset Challenges (1:00 - 2:30)
- **Problem**: Account takeovers, rapid cash-out draining, and smurfing rings.
- **Dataset**: PaySim benchmark (6.36 million transactions).
- **The Imbalance Trap**: Only 0.129% of transactions are fraudulent (1:773 ratio). A naive model predicting "Legitimate" achieves 99.87% accuracy while intercepting $0.
- **Why PR-AUC Matters**: We optimized on Precision-Recall AUC (0.923), not accuracy.

### Slide 3: Engineering Architecture & Feast Feature Store (2:30 - 4:00)
- **Architecture**:
  - Ingestion Gateway (FastAPI / Express REST APIs).
  - Feature Store (Feast) ensuring exact online/offline feature parity.
  - Streaming Pipeline (Kafka producer simulating live transaction load).
  - Relational Database (SQLite / PostgreSQL) with ACID guarantees.
- **Domain Features Engineered**:
  - `errorBalanceOrig`: Discrepancy between sender balance and transfer debit.
  - `errorBalanceDest`: PaySim anomaly where destination balance remains $0.
  - `amountToBalanceRatio`: Total account liquidations ($\ge 95\%$).
  - 60-minute rolling account velocity.

### Slide 4: Model Strategy: XGBoost + Graph Neural Network (4:00 - 6:00)
- **Tabular Modeling**: XGBoost trained with `scale_pos_weight=336.5` to compensate for class imbalance.
- **Graph Modeling (PyTorch Geometric)**: Heterogeneous graph connecting Accounts, Devices, and Cards. HeteroGraphSAGE embedding identifies money mule chains.
- **Ensemble Blend**: $65\%$ XGBoost tabular probability $+$ $35\%$ GNN structural embedding score.
- **Explainability**: Local SHAP feature attributions explaining each alert to investigators.

### Slide 5: Live Demonstration & Analyst Investigation Desk (6:00 - 8:00)
- **Live Demo Workflow**:
  1. Triggering an attack scenario via the Transaction Simulator (e.g., *Account Takeover Blitz* or *Smurfing Ring*).
  2. Sub-4ms scoring and automatic alert generation for probability $\ge 0.70$.
  3. Opening the **Investigation Desk** to examine balance deltas and counterparty history.
  4. Logging formal analyst decisions (`CONFIRMED_FRAUD` / `LEGITIMATE`) into the immutable audit trail.
  5. Viewing the **Account Network Graph** to uncover the mule ring topology.

### Slide 6: Results, Monitoring & Next Steps (8:00 - 10:00)
- **Performance**:
  - Precision: 94.2%
  - Recall: 88.7%
  - F1-Score: 91.4%
  - P95 Inference Latency: 3.8ms
- **Monitoring & MLOps**:
  - Evidently AI monitoring Kolmogorov-Smirnov data drift on transaction distributions.
  - MLflow tracking all training runs and hyperparameters.
  - Containerized deployment ready for Kubernetes (Minikube).
- **Next Steps**: Multi-region Kafka partitioning and biometric device fingerprint ingestion.

---

## Part 2: Individual Team / Intern Reflection Template

### Team Member 1: Machine Learning & Feature Engineering
- **Component Owned**: PaySim Exploratory Data Analysis, Feature Engineering pipeline, XGBoost hyperparameter tuning with `scale_pos_weight`, and MLflow tracking.
- **Key Challenges Overcome**: Handling the extreme 1:773 class imbalance without overfitting or creating data leakage from future timestamps.
- **What Was Learned**: Why accuracy is completely misleading for financial fraud, how to optimize Precision-Recall AUC, and how to calibrate decision thresholds against business loss tolerance.

### Team Member 2: Graph Neural Network & Network Intelligence
- **Component Owned**: PyTorch Geometric (PyG) HeteroData graph construction, HeteroGraphSAGE message passing, and topological pattern analysis (money mules, fan-in aggregators).
- **Key Challenges Overcome**: Scaling multi-hop neighbor sampling without latency bottlenecks during prediction time.
- **What Was Learned**: Graph embeddings capture structural laundering patterns that tabular models alone cannot detect.

### Team Member 3: Backend, Streaming & Data Infrastructure
- **Component Owned**: FastAPI ingestion gateway, Feast feature store definition, Kafka producer/consumer pipeline, and relational ACID database schema.
- **Key Challenges Overcome**: Ensuring sub-5ms total API response time under high ingestion frequency while preventing duplicate transaction IDs.
- **What Was Learned**: Decoupling real-time prediction from heavy batch retraining, and ensuring online/offline feature parity.

### Team Member 4: Frontend & Analyst Investigation Experience
- **Component Owned**: React dashboard, Recharts temporal telemetry, split-screen alert investigation desk, interactive SVG account network graph, and simulator controls.
- **Key Challenges Overcome**: Visualizing complex multi-hop transaction topologies clearly without cluttering the UI, and providing clear SHAP explanations.
- **What Was Learned**: Human-in-the-loop design is critical; ML scores must guide investigation, not replace human judgment.

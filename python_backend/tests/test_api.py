"""
Pytest Automated Test Suite for FastAPI Application
Real-Time Financial Fraud Detection Platform
"""

from fastapi.testclient import TestClient
from python_backend.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"
    assert data["model_loaded"] is True

def test_high_risk_transaction_ingestion():
    payload = {
        "type": "TRANSFER",
        "amount": 350000.0,
        "nameOrig": "C192847192",
        "oldbalanceOrg": 350000.0,
        "newbalanceOrig": 0.0,
        "nameDest": "C992817263",
        "oldbalanceDest": 0.0,
        "newbalanceDest": 0.0
    }
    response = client.post("/transactions", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["riskCategory"] == "HIGH"
    assert data["fraudProbability"] >= 0.70
    assert data["alertGenerated"] is True
    assert "Total Account Balance Liquidation (100%)" in data["ruleTriggers"]

def test_low_risk_retail_payment():
    payload = {
        "type": "PAYMENT",
        "amount": 25.0,
        "nameOrig": "C551829304",
        "oldbalanceOrg": 500.0,
        "newbalanceOrig": 475.0,
        "nameDest": "M992817264",
        "oldbalanceDest": 0.0,
        "newbalanceDest": 0.0
    }
    response = client.post("/transactions", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["riskCategory"] == "LOW"
    assert data["fraudProbability"] < 0.30
    assert data["alertGenerated"] is False

def test_invalid_transaction_validation():
    payload = {
        "type": "INVALID_TYPE",
        "amount": -10.0,
        "nameOrig": "",
        "oldbalanceOrg": 100.0,
        "newbalanceOrig": 100.0,
        "nameDest": "C123",
        "oldbalanceDest": 0.0,
        "newbalanceDest": 0.0
    }
    response = client.post("/transactions", json=payload)
    assert response.status_code == 422 # Pydantic validation error

def test_model_insights_endpoint():
    response = client.get("/model-insights")
    assert response.status_code == 200
    data = response.json()
    assert data["metrics"]["precision"] >= 0.85
    assert data["metrics"]["recall"] >= 0.80

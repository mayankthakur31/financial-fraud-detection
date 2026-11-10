"""
Pydantic Validation Schemas
Real-Time Financial Fraud Detection Platform
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator

class TransactionCreate(BaseModel):
    id: Optional[str] = None
    step: int = Field(default=1, ge=1, description="Simulation or time step (1 step = 1 hour)")
    type: Literal["PAYMENT", "TRANSFER", "CASH_OUT", "DEBIT", "CASH_IN"]
    amount: float = Field(..., ge=0, description="Transaction monetary amount")
    nameOrig: str = Field(..., min_length=1, description="Originator account identifier")
    oldbalanceOrg: float = Field(..., ge=0, description="Originator initial balance")
    newbalanceOrig: float = Field(..., ge=0, description="Originator final balance")
    nameDest: str = Field(..., min_length=1, description="Beneficiary account identifier")
    oldbalanceDest: float = Field(..., ge=0, description="Beneficiary initial balance")
    newbalanceDest: float = Field(..., ge=0, description="Beneficiary final balance")
    timestamp: Optional[int] = None

class FeatureAttribution(BaseModel):
    feature: str
    value: str
    contribution: float
    description: str

class TransactionResponse(BaseModel):
    transactionId: str
    fraudProbability: float
    riskCategory: Literal["LOW", "MEDIUM", "HIGH"]
    alertGenerated: bool
    alertId: Optional[str] = None
    ruleTriggers: List[str]
    modelVersion: str
    inferenceLatencyMs: float
    totalLatencyMs: float
    timestamp: int
    attributions: List[FeatureAttribution]

class ReviewCreate(BaseModel):
    alertId: str
    transactionId: str
    analystId: str
    decision: Literal["CONFIRMED_FRAUD", "LEGITIMATE", "ESCALATED"]
    notes: str

class AlertUpdate(BaseModel):
    status: Literal["PENDING", "UNDER_REVIEW", "RESOLVED_LEGITIMATE", "RESOLVED_FRAUD", "ESCALATED"]

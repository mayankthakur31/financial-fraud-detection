"""
SQLAlchemy Database Models for PostgreSQL / SQLite
Real-Time Financial Fraud Detection Platform
"""

import time
from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text, CheckConstraint, Index
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(64), primary_key=True, index=True)
    step = Column(Integer, nullable=False)
    type = Column(String(16), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    name_orig = Column(String(64), nullable=False, index=True)
    old_balance_orig = Column(Float, nullable=False)
    new_balance_orig = Column(Float, nullable=False)
    name_dest = Column(String(64), nullable=False, index=True)
    old_balance_dest = Column(Float, nullable=False)
    new_balance_dest = Column(Float, nullable=False)
    timestamp = Column(Integer, nullable=False, default=lambda: int(time.time() * 1000), index=True)
    is_synthetic = Column(Integer, default=0)

    prediction = relationship("FraudPrediction", back_populates="transaction", uselist=False, cascade="all, delete-orphan")
    alert = relationship("Alert", back_populates="transaction", uselist=False, cascade="all, delete-orphan")
    reviews = relationship("AnalystReview", back_populates="transaction", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("amount >= 0", name="check_positive_amount"),
        CheckConstraint("type IN ('PAYMENT', 'TRANSFER', 'CASH_OUT', 'DEBIT', 'CASH_IN')", name="check_tx_type"),
    )

class FraudPrediction(Base):
    __tablename__ = "fraud_predictions"

    id = Column(String(64), primary_key=True)
    transaction_id = Column(String(64), ForeignKey("transactions.id", ondelete="CASCADE"), unique=True, nullable=False)
    fraud_probability = Column(Float, nullable=False, index=True)
    risk_category = Column(String(16), nullable=False, index=True) # 'LOW', 'MEDIUM', 'HIGH'
    model_version = Column(String(32), nullable=False)
    feature_attributions = Column(Text, nullable=False) # JSON
    inference_latency_ms = Column(Float, nullable=False)
    created_at = Column(Integer, nullable=False, default=lambda: int(time.time() * 1000))

    transaction = relationship("Transaction", back_populates="prediction")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(64), primary_key=True)
    transaction_id = Column(String(64), ForeignKey("transactions.id", ondelete="CASCADE"), unique=True, nullable=False)
    severity = Column(String(16), nullable=False, index=True) # 'LOW', 'MEDIUM', 'HIGH'
    status = Column(String(32), nullable=False, index=True, default="PENDING") # 'PENDING', 'UNDER_REVIEW', 'RESOLVED_LEGITIMATE', 'RESOLVED_FRAUD', 'ESCALATED'
    rule_triggers = Column(Text, nullable=False) # JSON
    created_at = Column(Integer, nullable=False, default=lambda: int(time.time() * 1000))
    updated_at = Column(Integer, nullable=False, default=lambda: int(time.time() * 1000))

    transaction = relationship("Transaction", back_populates="alert")
    reviews = relationship("AnalystReview", back_populates="alert", cascade="all, delete-orphan")

class AnalystReview(Base):
    __tablename__ = "analyst_reviews"

    id = Column(String(64), primary_key=True)
    alert_id = Column(String(64), ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False)
    transaction_id = Column(String(64), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    analyst_id = Column(String(64), nullable=False)
    decision = Column(String(32), nullable=False) # 'CONFIRMED_FRAUD', 'LEGITIMATE', 'ESCALATED'
    notes = Column(Text, nullable=False)
    created_at = Column(Integer, nullable=False, default=lambda: int(time.time() * 1000))

    alert = relationship("Alert", back_populates="reviews")
    transaction = relationship("Transaction", back_populates="reviews")

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String(64), primary_key=True)
    action = Column(String(64), nullable=False)
    entity_type = Column(String(32), nullable=False)
    entity_id = Column(String(64), nullable=False)
    details = Column(Text, nullable=True) # JSON
    timestamp = Column(Integer, nullable=False, default=lambda: int(time.time() * 1000))

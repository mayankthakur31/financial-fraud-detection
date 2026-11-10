"""
Feast Feature Store Definitions
Ensures exact parity between offline training and online serving features.
"""

from datetime import timedelta
from feast import Entity, Field, FeatureView, FileSource
from feast.types import Float32, Int64, String

# 1. Define Entities
account_entity = Entity(
    name="account_id",
    join_keys=["account_id"],
    description="Customer or merchant account identifier"
)

# 2. Source Definition
account_stats_source = FileSource(
    path="data/account_features.parquet",
    timestamp_field="event_timestamp",
    created_timestamp_column="created_timestamp"
)

# 3. Feature View: Online & Offline identical features
account_features_view = FeatureView(
    name="account_fraud_features",
    entities=[account_entity],
    ttl=timedelta(days=30),
    schema=[
        Field(name="tx_velocity_1h", dtype=Int64),
        Field(name="tx_velocity_24h", dtype=Int64),
        Field(name="amount_vs_user_avg_ratio", dtype=Float32),
        Field(name="balance_drain_ratio", dtype=Float32),
        Field(name="consecutive_failed_logins", dtype=Int64),
        Field(name="device_change_flag", dtype=Int64),
        Field(name="location_country_mismatch", dtype=Int64)
    ],
    online=True,
    source=account_stats_source
)

"""
Apache Kafka Transaction Producer
Streams financial transactions to topic 'financial.transactions' for real-time ingestion.
"""

import json
import time
import random

KAFKA_TOPIC = "financial.transactions"
BOOTSTRAP_SERVERS = "localhost:9092"

def generate_stream_transaction(step: int) -> dict:
    is_fraud = random.random() < 0.15
    orig_id = f"C{random.randint(100000000, 999999999)}"
    dest_id = f"C{random.randint(100000000, 999999999)}"

    if is_fraud:
        bal = random.randint(50000, 400000)
        return {
            "step": step,
            "type": "TRANSFER",
            "amount": float(bal),
            "nameOrig": orig_id,
            "oldbalanceOrg": float(bal),
            "newbalanceOrig": 0.0,
            "nameDest": dest_id,
            "oldbalanceDest": 0.0,
            "newbalanceDest": 0.0,
            "timestamp": int(time.time() * 1000)
        }
    else:
        bal = random.randint(1000, 15000)
        amt = round(random.uniform(15.0, 350.0), 2)
        return {
            "step": step,
            "type": "PAYMENT",
            "amount": amt,
            "nameOrig": orig_id,
            "oldbalanceOrg": float(bal),
            "newbalanceOrig": float(bal - amt),
            "nameDest": f"M{random.randint(100000000, 999999999)}",
            "oldbalanceDest": 0.0,
            "newbalanceDest": 0.0,
            "timestamp": int(time.time() * 1000)
        }

def start_producer(count: int = 10, rate_per_sec: float = 1.0):
    print(f"[Kafka Producer] Connecting to {BOOTSTRAP_SERVERS} on topic '{KAFKA_TOPIC}'...")
    interval = 1.0 / rate_per_sec

    for i in range(count):
        tx = generate_stream_transaction(step=150 + i)
        print(f"[Kafka >> {KAFKA_TOPIC}] Emitted {tx['type']} ${tx['amount']:,.2f} ({tx['nameOrig']} -> {tx['nameDest']})")
        time.sleep(interval)

if __name__ == "__main__":
    start_producer(count=5, rate_per_sec=2.0)

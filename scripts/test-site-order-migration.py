"""Check that the additive site-order migration preserves historical rows."""

import sqlite3
from pathlib import Path


root = Path(__file__).resolve().parents[1]
with sqlite3.connect(":memory:") as db:
    db.executescript((root / "migrations/0001_site_requests.sql").read_text())
    db.execute(
        "INSERT INTO site_orders(request_id, submission_id, received_at, customer_name, "
        "customer_contact, delivery_method) VALUES (?, ?, ?, ?, ?, ?)",
        ("historical", "submission", "2026-01-01T00:00:00Z", "Synthetic", "synthetic", "pickup"),
    )
    db.execute(
        "INSERT INTO site_order_items(request_id, line_no, plant_id, product_name, "
        "container, unit, qty, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ("historical", 1, "PLANT-0001", "Synthetic", "V120", "piece", 1, 10),
    )
    db.executescript((root / "migrations/0002_site_order_variant_id.sql").read_text())
    assert db.execute(
        "SELECT variant_id FROM site_order_items WHERE request_id = ?", ("historical",)
    ).fetchone() == ("",)
    db.execute(
        "INSERT INTO site_order_items(request_id, line_no, plant_id, variant_id, product_name, "
        "container, unit, qty, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("historical", 2, "PLANT-0001", "VAR-PLANT-0001-V120", "Synthetic", "V120", "piece", 1, 10),
    )
    assert db.execute(
        "SELECT variant_id FROM site_order_items WHERE line_no = 2"
    ).fetchone() == ("VAR-PLANT-0001-V120",)

print("Site order migrations passed.")

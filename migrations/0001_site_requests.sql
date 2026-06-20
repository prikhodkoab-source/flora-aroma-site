CREATE TABLE IF NOT EXISTS site_orders (
  request_id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE,
  received_at TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_contact TEXT NOT NULL,
  delivery_method TEXT NOT NULL,
  delivery_address TEXT NOT NULL DEFAULT '',
  customer_comment TEXT NOT NULL DEFAULT '',
  telegram_status TEXT NOT NULL DEFAULT 'pending',
  telegram_error TEXT NOT NULL DEFAULT '',
  sync_status TEXT NOT NULL DEFAULT 'new',
  imported_at TEXT
);

CREATE TABLE IF NOT EXISTS site_order_items (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  line_no INTEGER NOT NULL,
  plant_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  container TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  FOREIGN KEY (request_id) REFERENCES site_orders(request_id),
  UNIQUE (request_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_site_orders_sync_status
  ON site_orders(sync_status, received_at);

CREATE INDEX IF NOT EXISTS idx_site_order_items_request_id
  ON site_order_items(request_id, line_no);

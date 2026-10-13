-- Preserve the catalog variant accepted at checkout for subsequent Flora intake.
-- Existing historical rows remain unknown and require operator review if ambiguous.
ALTER TABLE site_order_items ADD COLUMN variant_id TEXT NOT NULL DEFAULT '';

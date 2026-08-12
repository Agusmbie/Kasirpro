ALTER TABLE sale_items ADD COLUMN list_price DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER purchase_price;

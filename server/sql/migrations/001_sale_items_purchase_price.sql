ALTER TABLE sale_items ADD COLUMN purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER selling_price;

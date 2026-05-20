-- Migration: 20240013_auto_update_product_status.sql
-- Description: Automatically update the product status based on stock levels

CREATE OR REPLACE FUNCTION update_product_status()
RETURNS TRIGGER AS $$
DECLARE
  total_qty INTEGER;
  low_stock_count INTEGER;
BEGIN
  -- We calculate the status for the product_id involved in the change
  
  -- Calculate total quantity for this product
  SELECT COALESCE(SUM(quantity), 0) INTO total_qty
  FROM product_sizes
  WHERE product_id = NEW.product_id;

  -- Check if any size is at or below reorder level
  SELECT COUNT(*) INTO low_stock_count
  FROM product_sizes
  WHERE product_id = NEW.product_id AND quantity <= reorder_level;

  -- Update the product status
  IF total_qty = 0 THEN
    UPDATE products SET status = 'out_of_stock' WHERE id = NEW.product_id;
  ELSIF low_stock_count > 0 THEN
    UPDATE products SET status = 'low' WHERE id = NEW.product_id;
  ELSE
    UPDATE products SET status = 'in_stock' WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_product_status ON product_sizes;
CREATE TRIGGER trigger_update_product_status
AFTER INSERT OR UPDATE ON product_sizes
FOR EACH ROW
EXECUTE FUNCTION update_product_status();

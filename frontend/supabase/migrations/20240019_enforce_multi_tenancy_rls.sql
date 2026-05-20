-- Migration: 20240019_enforce_multi_tenancy_rls.sql
-- Description: Fix missing store_id columns and enforce multi-tenancy RLS

-- 1. Ensure store_id exists on all tables
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'store_id') THEN
    ALTER TABLE products ADD COLUMN store_id UUID REFERENCES stores(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'store_id') THEN
    ALTER TABLE stock_movements ADD COLUMN store_id UUID REFERENCES stores(id);
  END IF;
END $$;

-- 2. Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- 3. Helper for RLS (ensure it exists and is robust)
CREATE OR REPLACE FUNCTION get_user_store(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM users WHERE id = p_user_id;
$$;

-- 4. Drop existing loose policies
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "allow_read_products" ON products;
DROP POLICY IF EXISTS "allow_insert_products" ON products;
DROP POLICY IF EXISTS "allow_update_products" ON products;
DROP POLICY IF EXISTS "allow_delete_products" ON products;
DROP POLICY IF EXISTS "products_select_store" ON products;
DROP POLICY IF EXISTS "products_insert_store" ON products;
DROP POLICY IF EXISTS "products_update_store" ON products;
DROP POLICY IF EXISTS "products_delete_store" ON products;

DROP POLICY IF EXISTS "allow_read_product_sizes" ON product_sizes;
DROP POLICY IF EXISTS "allow_insert_product_sizes" ON product_sizes;
DROP POLICY IF EXISTS "allow_update_product_sizes" ON product_sizes;
DROP POLICY IF EXISTS "allow_delete_product_sizes" ON product_sizes;
DROP POLICY IF EXISTS "product_sizes_select_store" ON product_sizes;

DROP POLICY IF EXISTS "stock_movements_select" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert" ON stock_movements;
DROP POLICY IF EXISTS "movements_select_store" ON stock_movements;
DROP POLICY IF EXISTS "movements_insert_store" ON stock_movements;

DROP POLICY IF EXISTS "categories_select" ON categories;
DROP POLICY IF EXISTS "categories_insert" ON categories;

DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;

-- 5. Create Robust Multi-Tenant Policies

-- PRODUCTS
CREATE POLICY "products_multi_tenant_select" ON products FOR SELECT
  USING (store_id = get_user_store(auth.uid()));

CREATE POLICY "products_multi_tenant_insert" ON products FOR INSERT
  WITH CHECK (store_id = get_user_store(auth.uid()));

CREATE POLICY "products_multi_tenant_update" ON products FOR UPDATE
  USING (store_id = get_user_store(auth.uid()));

CREATE POLICY "products_multi_tenant_delete" ON products FOR DELETE
  USING (store_id = get_user_store(auth.uid()));

-- PRODUCT SIZES
CREATE POLICY "product_sizes_multi_tenant_select" ON product_sizes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = product_sizes.product_id 
    AND p.store_id = get_user_store(auth.uid())
  ));

CREATE POLICY "product_sizes_multi_tenant_insert" ON product_sizes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = product_id 
    AND p.store_id = get_user_store(auth.uid())
  ));

-- STOCK MOVEMENTS
CREATE POLICY "stock_movements_multi_tenant_select" ON stock_movements FOR SELECT
  USING (store_id = get_user_store(auth.uid()));

CREATE POLICY "stock_movements_multi_tenant_insert" ON stock_movements FOR INSERT
  WITH CHECK (store_id = get_user_store(auth.uid()));

-- CATEGORIES
CREATE POLICY "categories_multi_tenant_select" ON categories FOR SELECT
  USING (store_id = get_user_store(auth.uid()));

-- SUPPLIERS
CREATE POLICY "suppliers_multi_tenant_select" ON suppliers FOR SELECT
  USING (store_id = get_user_store(auth.uid()));

-- STORES
CREATE POLICY "stores_multi_tenant_select" ON stores FOR SELECT
  USING (id = get_user_store(auth.uid()));

-- 6. Trigger to auto-set store_id on insert
CREATE OR REPLACE FUNCTION set_store_id_from_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.store_id IS NULL THEN
    NEW.store_id := get_user_store(auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_product_store ON products;
CREATE TRIGGER trg_set_product_store
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION set_store_id_from_user();

DROP TRIGGER IF EXISTS trg_set_movement_store ON stock_movements;
CREATE TRIGGER trg_set_movement_store
  BEFORE INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION set_store_id_from_user();

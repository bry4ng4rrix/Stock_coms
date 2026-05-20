-- Migration: 20240021_fix_missing_rls_policies.sql
-- Description: Add missing RLS policies dropped in migration 20240019 but not recreated.
--   - product_sizes: UPDATE and DELETE (required for stock movements)
--   - suppliers: INSERT, UPDATE, DELETE + auto store_id trigger
--   - categories: INSERT, UPDATE, DELETE + auto store_id trigger
--   - notifications: SELECT, UPDATE, INSERT, DELETE (required for notifications page)

-- ── product_sizes ─────────────────────────────────────────────
-- UPDATE needed: stock movements update product_sizes.quantity
DROP POLICY IF EXISTS "product_sizes_multi_tenant_update" ON product_sizes;
CREATE POLICY "product_sizes_multi_tenant_update" ON product_sizes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_sizes.product_id
    AND p.store_id = get_user_store(auth.uid())
  ));

DROP POLICY IF EXISTS "product_sizes_multi_tenant_delete" ON product_sizes;
CREATE POLICY "product_sizes_multi_tenant_delete" ON product_sizes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_sizes.product_id
    AND p.store_id = get_user_store(auth.uid())
  ));

-- ── suppliers ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "suppliers_multi_tenant_insert" ON suppliers;
CREATE POLICY "suppliers_multi_tenant_insert" ON suppliers FOR INSERT
  WITH CHECK (store_id = get_user_store(auth.uid()));

DROP POLICY IF EXISTS "suppliers_multi_tenant_update" ON suppliers;
CREATE POLICY "suppliers_multi_tenant_update" ON suppliers FOR UPDATE
  USING (store_id = get_user_store(auth.uid()));

DROP POLICY IF EXISTS "suppliers_multi_tenant_delete" ON suppliers;
CREATE POLICY "suppliers_multi_tenant_delete" ON suppliers FOR DELETE
  USING (store_id = get_user_store(auth.uid()));

-- Trigger to auto-set store_id on supplier insert (mirrors the products trigger)
DROP TRIGGER IF EXISTS trg_set_supplier_store ON suppliers;
CREATE TRIGGER trg_set_supplier_store
  BEFORE INSERT ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_store_id_from_user();

-- ── categories ────────────────────────────────────────────────
DROP POLICY IF EXISTS "categories_multi_tenant_insert" ON categories;
CREATE POLICY "categories_multi_tenant_insert" ON categories FOR INSERT
  WITH CHECK (store_id = get_user_store(auth.uid()));

DROP POLICY IF EXISTS "categories_multi_tenant_update" ON categories;
CREATE POLICY "categories_multi_tenant_update" ON categories FOR UPDATE
  USING (store_id = get_user_store(auth.uid()));

DROP POLICY IF EXISTS "categories_multi_tenant_delete" ON categories;
CREATE POLICY "categories_multi_tenant_delete" ON categories FOR DELETE
  USING (store_id = get_user_store(auth.uid()));

-- Trigger to auto-set store_id on category insert
DROP TRIGGER IF EXISTS trg_set_category_store ON categories;
CREATE TRIGGER trg_set_category_store
  BEFORE INSERT ON categories
  FOR EACH ROW EXECUTE FUNCTION set_store_id_from_user();

-- ── notifications ─────────────────────────────────────────────
-- RLS was enabled in migration 20240019 but no user-facing policies were created.
-- Triggers use SECURITY DEFINER so they bypass RLS for INSERT — only user reads/writes need policies.
DROP POLICY IF EXISTS "notifications_multi_tenant_select" ON notifications;
CREATE POLICY "notifications_multi_tenant_select" ON notifications FOR SELECT
  USING (store_id = get_user_store(auth.uid()));

DROP POLICY IF EXISTS "notifications_multi_tenant_update" ON notifications;
CREATE POLICY "notifications_multi_tenant_update" ON notifications FOR UPDATE
  USING (store_id = get_user_store(auth.uid()));

DROP POLICY IF EXISTS "notifications_multi_tenant_delete" ON notifications;
CREATE POLICY "notifications_multi_tenant_delete" ON notifications FOR DELETE
  USING (store_id = get_user_store(auth.uid()));

-- Allow direct insert for service-role and future admin-level inserts
DROP POLICY IF EXISTS "notifications_multi_tenant_insert" ON notifications;
CREATE POLICY "notifications_multi_tenant_insert" ON notifications FOR INSERT
  WITH CHECK (store_id = get_user_store(auth.uid()));

-- ── stores: UPDATE policy (missing in migration 20240019) ────
DROP POLICY IF EXISTS "stores_multi_tenant_update" ON stores;
CREATE POLICY "stores_multi_tenant_update" ON stores FOR UPDATE
  USING (id = get_user_store(auth.uid()));

-- ============================================================
-- Migration: 20240023_cosmetics_schema.sql
-- Description: Adapt schema from clothing to cosmetics.
--   1. Add brand, direct quantity, reorder_level to products.
--   2. Auto-update product status from direct quantity.
--   3. Trigger on stock_movements → auto-update products.quantity.
--   4. Re-add notify_stock_movement trigger (lost after migration 20240010 dropped the table).
--   5. Role-based RLS: employees cannot create/edit/delete products.
--   6. Helper function get_user_role.
-- ============================================================

-- ── 1. Product columns for cosmetics ─────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 5;

-- Drop clothing-specific column not relevant for cosmetics
ALTER TABLE products DROP COLUMN IF EXISTS material;

-- ── 2. BEFORE trigger: auto-set product status from direct quantity ──
CREATE OR REPLACE FUNCTION update_product_status_direct()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity IS NOT NULL AND NEW.reorder_level IS NOT NULL THEN
    IF NEW.quantity = 0 THEN
      NEW.status := 'out_of_stock';
    ELSIF NEW.quantity <= NEW.reorder_level THEN
      NEW.status := 'low';
    ELSE
      NEW.status := 'in_stock';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_status_direct ON products;
CREATE TRIGGER trg_product_status_direct
  BEFORE INSERT OR UPDATE OF quantity, reorder_level ON products
  FOR EACH ROW EXECUTE FUNCTION update_product_status_direct();

-- ── 3. AFTER trigger on stock_movements → update products.quantity ──
-- This replaces the manual quantity update previously done in the frontend.
CREATE OR REPLACE FUNCTION update_product_quantity_on_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_current_qty INTEGER;
BEGIN
  SELECT quantity INTO v_current_qty FROM products WHERE id = NEW.product_id;

  IF NEW.type = 'entry' THEN
    UPDATE products
      SET quantity = COALESCE(v_current_qty, 0) + NEW.quantity
      WHERE id = NEW.product_id;

  ELSIF NEW.type = 'exit' THEN
    IF COALESCE(v_current_qty, 0) < NEW.quantity THEN
      RAISE EXCEPTION 'Stock insuffisant : % unité(s) disponible(s), % demandée(s)',
        COALESCE(v_current_qty, 0), NEW.quantity;
    END IF;
    UPDATE products
      SET quantity = COALESCE(v_current_qty, 0) - NEW.quantity
      WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_product_qty ON stock_movements;
CREATE TRIGGER trg_update_product_qty
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION update_product_quantity_on_movement();

-- ── 4. Re-add notify_stock_movement (was lost when migration 20240010 dropped stock_movements) ──
CREATE OR REPLACE FUNCTION notify_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
  v_store_id     UUID;
  v_user_name    TEXT;
  v_action       TEXT;
BEGIN
  SELECT name, store_id INTO v_product_name, v_store_id
    FROM products WHERE id = NEW.product_id;

  SELECT full_name INTO v_user_name
    FROM users WHERE id = NEW.user_id;

  v_user_name := COALESCE(v_user_name, 'Système');
  v_action    := CASE WHEN NEW.type = 'entry' THEN 'Entrée' ELSE 'Sortie' END;

  IF v_store_id IS NOT NULL THEN
    INSERT INTO notifications (store_id, type, title, message, related_entity_id)
    VALUES (
      v_store_id,
      'system',
      v_action || ' de stock : ' || v_product_name,
      v_action || ' de ' || NEW.quantity || ' unité(s) par ' || v_user_name
        || COALESCE('. Notes : ' || NEW.notes, ''),
      NEW.product_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_stock_movement ON stock_movements;
CREATE TRIGGER trg_notify_stock_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION notify_stock_movement();

-- ── 5. AFTER trigger on products → create stock alert ──────────
CREATE OR REPLACE FUNCTION create_stock_alert_direct()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity <= NEW.reorder_level THEN
    INSERT INTO stock_alerts (
      product_id, alert_type, current_quantity, reorder_level, is_active
    ) VALUES (
      NEW.id,
      CASE WHEN NEW.quantity = 0 THEN 'out_of_stock' ELSE 'low_stock' END,
      NEW.quantity,
      NEW.reorder_level,
      true
    )
    ON CONFLICT DO NOTHING;
  ELSE
    -- Resolve active alerts when stock is replenished
    UPDATE stock_alerts
      SET is_active = false, resolved_at = NOW()
      WHERE product_id = NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_product_stock_alert ON products;
CREATE TRIGGER trg_product_stock_alert
  AFTER INSERT OR UPDATE OF quantity ON products
  FOR EACH ROW EXECUTE FUNCTION create_stock_alert_direct();

-- ── 6. Helper: get user role ──────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_role(p_user_id uuid)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  RETURN COALESCE(v_role, 'employer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6.5 Helper: get user store ──────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_store(p_user_id uuid)
RETURNS UUID AS $$
DECLARE
  v_store_id UUID;
BEGIN
  SELECT store_id INTO v_store_id FROM users WHERE id = p_user_id;
  RETURN v_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 7. Role-based RLS on products ───────────────────────────
-- Drop all existing product policies and rebuild with role enforcement.
DROP POLICY IF EXISTS "products_multi_tenant_select" ON products;
DROP POLICY IF EXISTS "products_multi_tenant_insert" ON products;
DROP POLICY IF EXISTS "products_multi_tenant_update" ON products;
DROP POLICY IF EXISTS "products_multi_tenant_delete" ON products;
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;

-- All store members can read products
CREATE POLICY "products_select" ON products FOR SELECT
  USING (store_id = get_user_store(auth.uid()));

-- Only admin and magasinier can create products
CREATE POLICY "products_insert" ON products FOR INSERT
  WITH CHECK (
    store_id IS NOT NULL
    AND store_id = get_user_store(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'magasinier')
  );

-- Only admin and magasinier can edit products (not direct quantity — movements handle that)
CREATE POLICY "products_update" ON products FOR UPDATE
  USING (
    store_id = get_user_store(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'magasinier')
  );

-- Only admin can delete products
CREATE POLICY "products_delete" ON products FOR DELETE
  USING (
    store_id = get_user_store(auth.uid())
    AND get_user_role(auth.uid()) = 'admin'
  );

-- ── 8. Rebuild set_store_id_from_user to also enforce role on products ──
-- (already done by RLS policy above — trigger just auto-fills store_id)

-- ── 9. Tighten stock_movements policies ──────────────────────
DROP POLICY IF EXISTS "stock_movements_multi_tenant_select" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_multi_tenant_insert" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_select" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert" ON stock_movements;

-- All store members can read their store's movements
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT
  USING (store_id = get_user_store(auth.uid()));

-- All store members (including employees) can INSERT movements
-- The store_id is auto-set by the trigger; must belong to their store
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT
  WITH CHECK (store_id IS NOT NULL AND store_id = get_user_store(auth.uid()));

-- Movements are immutable — no UPDATE or DELETE by any user role (audit trail integrity)

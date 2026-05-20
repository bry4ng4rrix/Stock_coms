-- ============================================================
-- Migration: 20240004_fix_products_rls
-- Description: Fix products RLS for all roles + fallback
-- ============================================================

-- Robust role check: returns 'magasinier' if user not found (signup edge-case)
CREATE OR REPLACE FUNCTION get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  RETURN COALESCE(v_role, 'magasinier');
END;
$$;

-- ── Fix products policies ────────────────────────────────────
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;

CREATE POLICY "products_insert" ON products FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'magasinier'));

CREATE POLICY "products_update" ON products FOR UPDATE
  USING (get_user_role(auth.uid()) IN ('admin', 'magasinier'));

CREATE POLICY "products_delete" ON products FOR DELETE
  USING (get_user_role(auth.uid()) IN ('admin', 'magasinier'));

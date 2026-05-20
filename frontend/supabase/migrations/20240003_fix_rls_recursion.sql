-- ============================================================
-- Migration: 20240003_fix_rls_recursion
-- Description: Fix infinite recursion in users RLS policies
-- ============================================================

-- Helper function to read user role without triggering RLS recursion.
-- SECURITY DEFINER runs as the function owner (postgres) which
-- bypasses RLS, avoiding the circular policy check.
CREATE OR REPLACE FUNCTION get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE id = p_user_id;
$$;

-- ── Fix users policies ───────────────────────────────────────
DROP POLICY IF EXISTS "users_select" ON users;

CREATE POLICY "users_select" ON users FOR SELECT
  USING (auth.uid() = id OR get_user_role(auth.uid()) = 'admin');

-- ── Fix products policies ──────────────────────────────────
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;

CREATE POLICY "products_insert" ON products FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "products_update" ON products FOR UPDATE
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "products_delete" ON products FOR DELETE
  USING (get_user_role(auth.uid()) = 'admin');

-- ── Fix suppliers policies ─────────────────────────────────
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;

CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- ── Fix categories policies ──────────────────────────────────
DROP POLICY IF EXISTS "categories_insert" ON categories;

CREATE POLICY "categories_insert" ON categories FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

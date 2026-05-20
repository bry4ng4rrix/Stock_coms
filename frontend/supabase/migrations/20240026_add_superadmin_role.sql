-- ============================================================
-- Migration: 20240026_add_superadmin_role
-- Description: Add superadmin role to support multi-level admin hierarchy
--              superadmin -> admin (magasin) -> employer, magasinier
-- ============================================================

-- 1. Drop existing role constraint and add superadmin
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('superadmin', 'admin', 'magasinier', 'employer'));

-- 2. Update get_user_role function to handle superadmin
CREATE OR REPLACE FUNCTION get_user_role(p_user_id uuid)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  RETURN COALESCE(v_role, 'employer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.5 Create get_user_store function (used by existing policies)
CREATE OR REPLACE FUNCTION get_user_store(p_user_id uuid)
RETURNS UUID AS $$
DECLARE
  v_store_id UUID;
BEGIN
  SELECT store_id INTO v_store_id FROM users WHERE id = p_user_id;
  RETURN v_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update RLS policies for users table
DROP POLICY IF EXISTS "users_select" ON users;
CREATE POLICY "users_select" ON users FOR SELECT
  USING (
    auth.uid() = id 
    OR get_user_role(auth.uid()) = 'superadmin'
    OR get_user_role(auth.uid()) = 'admin'
    OR (get_user_role(auth.uid()) = 'magasinier' AND store_id = get_user_store(auth.uid()))
    OR (get_user_role(auth.uid()) = 'magasinier' AND referred_by = auth.uid())
  );

DROP POLICY IF EXISTS "users_update" ON users;
CREATE POLICY "users_update" ON users FOR UPDATE
  USING (
    auth.uid() = id 
    OR get_user_role(auth.uid()) = 'superadmin'
    OR get_user_role(auth.uid()) = 'admin'
  )
  WITH CHECK (
    auth.uid() = id 
    OR get_user_role(auth.uid()) = 'superadmin'
    OR get_user_role(auth.uid()) = 'admin'
  );

-- 4. Update RLS policies for products table
-- Note: Migration 20240023 already created these policies, we need to update them to include superadmin
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT
  USING (
    store_id = get_user_store(auth.uid())
    OR get_user_role(auth.uid()) = 'superadmin'
  );

DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT
  WITH CHECK (
    store_id IS NOT NULL
    AND store_id = get_user_store(auth.uid())
    AND get_user_role(auth.uid()) IN ('superadmin', 'admin', 'magasinier')
  );

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products FOR UPDATE
  USING (
    store_id = get_user_store(auth.uid())
    AND get_user_role(auth.uid()) IN ('superadmin', 'admin', 'magasinier')
  );

DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products FOR DELETE
  USING (
    store_id = get_user_store(auth.uid())
    AND get_user_role(auth.uid()) IN ('superadmin', 'admin')
  );

-- 5. Update RLS policies for stores table
DROP POLICY IF EXISTS "stores_select" ON stores;
CREATE POLICY "stores_select" ON stores FOR SELECT
  USING (
    auth.role() = 'authenticated'
    OR get_user_role(auth.uid()) = 'superadmin'
  );

DROP POLICY IF EXISTS "stores_insert" ON stores;
CREATE POLICY "stores_insert" ON stores FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) IN ('superadmin', 'admin')
  );

DROP POLICY IF EXISTS "stores_update" ON stores;
CREATE POLICY "stores_update" ON stores FOR UPDATE
  USING (
    get_user_role(auth.uid()) IN ('superadmin', 'admin')
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "stores_delete" ON stores;
CREATE POLICY "stores_delete" ON stores FOR DELETE
  USING (
    get_user_role(auth.uid()) = 'superadmin'
    OR owner_id = auth.uid()
  );

-- 6. Update RLS policies for stock_movements
-- Note: Migration 20240023 already created these policies, we need to update them to include superadmin
DROP POLICY IF EXISTS "stock_movements_select" ON stock_movements;
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT
  USING (
    store_id = get_user_store(auth.uid())
    OR get_user_role(auth.uid()) = 'superadmin'
  );

DROP POLICY IF EXISTS "stock_movements_insert" ON stock_movements;
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT
  WITH CHECK (
    store_id IS NOT NULL
    AND store_id = get_user_store(auth.uid())
    OR get_user_role(auth.uid()) = 'superadmin'
  );

-- 7. Update RLS policies for suppliers
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT
  USING (
    auth.role() = 'authenticated'
    OR get_user_role(auth.uid()) = 'superadmin'
  );

DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) IN ('superadmin', 'admin')
  );

DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE
  USING (
    get_user_role(auth.uid()) IN ('superadmin', 'admin')
  );

DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE
  USING (
    get_user_role(auth.uid()) IN ('superadmin', 'admin')
  );

-- 8. Update RLS policies for categories
DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select" ON categories FOR SELECT
  USING (
    auth.role() = 'authenticated'
    OR get_user_role(auth.uid()) = 'superadmin'
  );

DROP POLICY IF EXISTS "categories_insert" ON categories;
CREATE POLICY "categories_insert" ON categories FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) IN ('superadmin', 'admin')
  );

DROP POLICY IF EXISTS "categories_update" ON categories;
CREATE POLICY "categories_update" ON categories FOR UPDATE
  USING (
    get_user_role(auth.uid()) IN ('superadmin', 'admin')
  );

DROP POLICY IF EXISTS "categories_delete" ON categories;
CREATE POLICY "categories_delete" ON categories FOR DELETE
  USING (
    get_user_role(auth.uid()) IN ('superadmin', 'admin')
  );

-- 9. Update RLS policies for notifications
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (
    auth.role() = 'authenticated'
    OR get_user_role(auth.uid()) = 'superadmin'
  );

-- 10. Update RLS policies for stock_alerts
DROP POLICY IF EXISTS "stock_alerts_select" ON stock_alerts;
CREATE POLICY "stock_alerts_select" ON stock_alerts FOR SELECT
  USING (
    auth.role() = 'authenticated'
    OR get_user_role(auth.uid()) = 'superadmin'
  );

DROP POLICY IF EXISTS "stock_alerts_insert" ON stock_alerts;
CREATE POLICY "stock_alerts_insert" ON stock_alerts FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    OR get_user_role(auth.uid()) = 'superadmin'
  );

-- 11. Update handle_new_user trigger to prevent public superadmin creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_full_name TEXT;
  v_status TEXT;
  v_store_name TEXT;
  v_store_id UUID;
  v_referred_by_email TEXT;
  v_manager_id UUID;
  v_store_logo TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employer');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_status := 'pending';
  v_store_name := NEW.raw_user_meta_data->>'store_name';
  v_referred_by_email := NEW.raw_user_meta_data->>'referred_by_email';
  v_store_logo := NEW.raw_user_meta_data->>'store_logo';

  -- SECURITY: Prevent superadmin creation via public signup
  IF v_role = 'superadmin' THEN
    RAISE EXCEPTION 'Superadmin accounts must be created manually by another superadmin';
  END IF;

  -- Validate role
  IF v_role NOT IN ('admin', 'magasinier', 'employer') THEN
    v_role := 'employer';
  END IF;

  -- Insert user
  INSERT INTO public.users (id, email, role, full_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    v_role,
    v_full_name,
    v_status
  );

  -- If admin with store name, create store
  IF v_role = 'admin' AND v_store_name IS NOT NULL THEN
    INSERT INTO public.stores (name, owner_id, logo_url)
    VALUES (v_store_name, NEW.id, v_store_logo)
    RETURNING id INTO v_store_id;

    UPDATE public.users SET store_id = v_store_id WHERE id = NEW.id;
  END IF;

  -- Update auth metadata with role
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', v_role, 'full_name', v_full_name)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Update audit logs policy
DROP POLICY IF EXISTS "audit_logs_select_admin" ON audit_logs;
CREATE POLICY "audit_logs_select_admin" ON audit_logs FOR SELECT
  USING (get_user_role(auth.uid()) IN ('superadmin', 'admin'));

-- 13. Document the role hierarchy
COMMENT ON TABLE users IS 'Table des utilisateurs avec rôles: superadmin (accès global), admin (gère un magasin), magasinier (manager), employer (employé)';
COMMENT ON FUNCTION get_user_role IS 'Retourne le rôle d''un utilisateur. Retourne ''employer'' par défaut si non trouvé.';
COMMENT ON FUNCTION handle_new_user IS 'Trigger appelé lors de la création d''un utilisateur. Empêche la création de superadmin via inscription publique.';

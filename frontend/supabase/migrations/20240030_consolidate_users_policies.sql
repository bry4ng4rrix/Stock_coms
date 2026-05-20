-- ============================================================
-- Migration: 20240030_consolidate_users_policies
-- Description: Drop all old policies and consolidate to prevent recursion
-- ============================================================

DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_update_admin" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;

CREATE POLICY "users_select" ON users FOR SELECT
  USING (
    auth.uid() = id 
    OR get_user_role(auth.uid()) = 'superadmin'
    OR get_user_role(auth.uid()) = 'admin'
    OR (get_user_role(auth.uid()) = 'magasinier' AND store_id = get_user_store(auth.uid()))
    OR (get_user_role(auth.uid()) = 'magasinier' AND referred_by = auth.uid())
  );

CREATE POLICY "users_update" ON users FOR UPDATE
  USING (
    auth.uid() = id 
    OR get_user_role(auth.uid()) = 'superadmin'
    OR get_user_role(auth.uid()) = 'admin'
    OR get_user_role(auth.uid()) = 'magasinier'
  )
  WITH CHECK (
    auth.uid() = id 
    OR get_user_role(auth.uid()) = 'superadmin'
    OR get_user_role(auth.uid()) = 'admin'
    OR get_user_role(auth.uid()) = 'magasinier'
  );

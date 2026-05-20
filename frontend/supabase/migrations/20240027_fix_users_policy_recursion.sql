-- ============================================================
-- Migration: 20240027_fix_users_policy_recursion
-- Description: Fix infinite recursion in users_select policy
-- ============================================================

DROP POLICY IF EXISTS "users_select" ON users;
CREATE POLICY "users_select" ON users FOR SELECT
  USING (
    auth.uid() = id 
    OR get_user_role(auth.uid()) = 'superadmin'
    OR get_user_role(auth.uid()) = 'admin'
    OR (get_user_role(auth.uid()) = 'magasinier' AND store_id = get_user_store(auth.uid()))
    OR (get_user_role(auth.uid()) = 'magasinier' AND referred_by = auth.uid())
  );

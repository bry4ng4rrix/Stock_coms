-- Migration: 20240014_fix_users_rls_store.sql
-- Description: Fix infinite recursion in users RLS policies caused by direct select on store_id

CREATE OR REPLACE FUNCTION get_user_store(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM users WHERE id = p_user_id;
$$;

DROP POLICY IF EXISTS "users_select" ON users;

CREATE POLICY "users_select" ON users FOR SELECT
  USING (
    auth.uid() = id 
    OR get_user_role(auth.uid()) = 'admin' 
    OR (get_user_role(auth.uid()) = 'magasinier' AND store_id = get_user_store(auth.uid()))
    OR (get_user_role(auth.uid()) = 'magasinier' AND referred_by = auth.uid())
  );

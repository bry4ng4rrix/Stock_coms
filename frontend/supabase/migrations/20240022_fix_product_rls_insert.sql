-- Migration: 20240022_fix_product_rls_insert.sql
-- Description: Fix the products INSERT RLS policy so that null = null does not
--   cause a violation. The trigger set_store_id_from_user runs BEFORE the RLS
--   check, so if the user has no store_id in the DB the trigger leaves
--   NEW.store_id = NULL, and then `NULL = NULL` evaluates to NULL (not TRUE),
--   which Supabase treats as a policy violation.
--
--   New approach:
--   1. Require store_id to be non-null (guards against users with no store).
--   2. Require it to match the authenticated user's store.
--   3. Also update the trigger to raise a clear error when a user has no store,
--      instead of silently allowing a null insert that fails obscurely.

-- Replace the products INSERT policy
DROP POLICY IF EXISTS "products_multi_tenant_insert" ON products;
CREATE POLICY "products_multi_tenant_insert" ON products FOR INSERT
  WITH CHECK (
    store_id IS NOT NULL
    AND store_id = get_user_store(auth.uid())
  );

-- Replace the trigger function with a version that raises a descriptive error
-- when a user has no store_id, instead of silently inserting null.
CREATE OR REPLACE FUNCTION set_store_id_from_user()
RETURNS TRIGGER AS $$
DECLARE
  v_store_id UUID;
BEGIN
  IF NEW.store_id IS NULL THEN
    v_store_id := get_user_store(auth.uid());
    IF v_store_id IS NULL THEN
      RAISE EXCEPTION 'L''utilisateur n''est associé à aucun magasin. Contactez votre administrateur.';
    END IF;
    NEW.store_id := v_store_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach existing triggers that use this function (they reference it by name,
-- so replacing the function body is sufficient — no need to recreate triggers).

-- Also update the users UPDATE policy so that an approver can set store_id on
-- another user (needed for handleUpdateStatus fix in users/page.tsx).
DROP POLICY IF EXISTS "users_update_admin" ON users;
CREATE POLICY "users_update_admin" ON users FOR UPDATE
  USING (
    auth.uid() = id
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'magasinier')
  )
  WITH CHECK (
    auth.uid() = id
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'magasinier')
  );

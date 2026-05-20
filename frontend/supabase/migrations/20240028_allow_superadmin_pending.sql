-- ============================================================
-- Migration: 20240028_allow_superadmin_pending_approval
-- Description: Allow superadmin and admin creation via public signup
--              with pending status awaiting approval
-- ============================================================

-- Add company_name column to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Update handle_new_user trigger to allow superadmin creation
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
  v_company_name TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employer');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_status := 'pending';
  v_store_name := NEW.raw_user_meta_data->>'store_name';
  v_referred_by_email := NEW.raw_user_meta_data->>'referred_by_email';
  v_store_logo := NEW.raw_user_meta_data->>'store_logo';
  v_company_name := NEW.raw_user_meta_data->>'company_name';

  -- Validate role
  IF v_role NOT IN ('superadmin', 'admin', 'magasinier', 'employer') THEN
    v_role := 'employer';
  END IF;

  -- Insert user with pending status
  INSERT INTO public.users (id, email, role, full_name, status, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    v_role,
    v_full_name,
    v_status,
    v_company_name
  );

  -- If admin with store name, create store (but don't activate yet)
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

-- Update comment
COMMENT ON FUNCTION handle_new_user IS 'Trigger appelé lors de la création d''un utilisateur. Superadmin et admin sont créés en statut pending et nécessitent une approbation.';

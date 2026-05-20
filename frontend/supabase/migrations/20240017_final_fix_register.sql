-- Migration: 20240017_final_fix_register.sql
-- Description: Fix handle_new_user trigger once and for all

-- 1. Ensure the function is correct and has the right search_path
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
  v_referred_by UUID;
  v_referred_by_email TEXT;
  v_full_name TEXT;
  v_store_name TEXT;
  v_store_id UUID;
  v_explicit_status TEXT;
BEGIN
  -- Extract metadata
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employer');
  v_explicit_status := NEW.raw_user_meta_data->>'status';
  v_referred_by_email := NEW.raw_user_meta_data->>'referred_by_email';
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_store_name := NEW.raw_user_meta_data->>'store_name';

  -- Clean up store name (handle empty strings)
  IF v_store_name = '' THEN
    v_store_name := NULL;
  END IF;

  -- Determine status
  IF v_explicit_status IS NOT NULL THEN
    v_status := v_explicit_status;
  ELSE
    IF v_role IN ('employer', 'magasinier') THEN
      v_status := 'pending';
    ELSE
      v_status := 'approved';
    END IF;
  END IF;

  -- Find referrer
  IF v_referred_by_email IS NOT NULL AND v_referred_by_email != '' THEN
    SELECT id INTO v_referred_by
    FROM public.users
    WHERE email = v_referred_by_email
    AND role IN ('admin', 'magasinier')
    LIMIT 1;
  END IF;

  -- Ensure role is valid
  IF v_role NOT IN ('admin', 'magasinier', 'employer') THEN
    v_role := 'admin';
    v_status := 'approved';
  END IF;

  -- Insert into public.users
  INSERT INTO public.users (
    id, email, role, full_name, status,
    referred_by, referred_by_email
  ) VALUES (
    NEW.id, NEW.email, v_role, v_full_name, v_status,
    v_referred_by, v_referred_by_email
  );

  -- If Admin, create store
  IF v_role = 'admin' AND v_store_name IS NOT NULL THEN
    INSERT INTO public.stores (name, owner_id) 
    VALUES (v_store_name, NEW.id) 
    RETURNING id INTO v_store_id;
    
    UPDATE public.users SET store_id = v_store_id WHERE id = NEW.id;
  END IF;

  -- If approved and has referrer, link to their store
  IF v_status = 'approved' AND v_referred_by IS NOT NULL THEN
    UPDATE public.users
    SET store_id = (SELECT store_id FROM public.users WHERE id = v_referred_by)
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error to debug_logs (make sure it exists)
  INSERT INTO public.debug_logs (message, details)
  VALUES ('handle_new_user: CRITICAL ERROR',
    jsonb_build_object(
      'error', SQLERRM,
      'state', SQLSTATE,
      'id', NEW.id,
      'email', NEW.email,
      'role', v_role
    )
  );
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Re-create the trigger to be sure it's active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

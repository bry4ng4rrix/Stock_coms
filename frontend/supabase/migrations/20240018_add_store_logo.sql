-- Migration: 20240018_add_store_logo
-- Description: Add logo_url column to stores table

ALTER TABLE stores ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Also add full_name to users metadata handling if missing (though it exists in schema)
-- And add logo_url to handle_new_user if we want to set it during registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
  v_referred_by UUID;
  v_referred_by_email TEXT;
  v_full_name TEXT;
  v_store_name TEXT;
  v_store_logo TEXT;
  v_store_id UUID;
  v_explicit_status TEXT;
BEGIN
  -- Extract metadata
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employer');
  v_explicit_status := NEW.raw_user_meta_data->>'status';
  v_referred_by_email := NEW.raw_user_meta_data->>'referred_by_email';
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_store_name := NEW.raw_user_meta_data->>'store_name';
  v_store_logo := NEW.raw_user_meta_data->>'store_logo';

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
    INSERT INTO public.stores (name, owner_id, logo_url) 
    VALUES (v_store_name, NEW.id, v_store_logo) 
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
  -- Log error to debug_logs
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

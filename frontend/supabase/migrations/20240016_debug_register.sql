-- ============================================================
-- Migration: 20240016_debug_register
-- Description: Ajoute un logging dans handle_new_user pour
--              identifier la cause exacte de l'erreur d'inscription
-- ============================================================

-- 1. Table temporaire de debug
CREATE TABLE IF NOT EXISTS debug_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  message TEXT,
  details JSONB
);

-- 2. Fonction de debug qui wrappe le trigger existant
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
  v_err_msg TEXT;
BEGIN
  BEGIN
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employer');
    v_explicit_status := NEW.raw_user_meta_data->>'status';
    v_referred_by_email := NEW.raw_user_meta_data->>'referred_by_email';
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
    v_store_name := NEW.raw_user_meta_data->>'store_name';

    IF v_explicit_status IS NOT NULL THEN
      v_status := v_explicit_status;
    ELSE
      IF v_role IN ('employer', 'magasinier') THEN
        v_status := 'pending';
      ELSE
        v_status := 'approved';
      END IF;
    END IF;

    IF v_referred_by_email IS NOT NULL THEN
      SELECT id INTO v_referred_by
      FROM users
      WHERE email = v_referred_by_email
      AND role IN ('admin', 'magasinier')
      LIMIT 1;
    END IF;

    IF v_role NOT IN ('admin', 'magasinier', 'employer') THEN
      v_role := 'admin';
      v_status := 'approved';
    END IF;

    -- Log avant insertion
    INSERT INTO debug_logs (message, details)
    VALUES ('handle_new_user: about to insert',
      jsonb_build_object(
        'id', NEW.id,
        'email', NEW.email,
        'role', v_role,
        'full_name', v_full_name,
        'status', v_status,
        'referred_by', v_referred_by,
        'referred_by_email', v_referred_by_email,
        'store_name', v_store_name
      )
    );

    INSERT INTO public.users (
      id, email, role, full_name, status,
      referred_by, referred_by_email
    ) VALUES (
      NEW.id, NEW.email, v_role, v_full_name, v_status,
      v_referred_by, v_referred_by_email
    );

    INSERT INTO debug_logs (message, details)
    VALUES ('handle_new_user: insert OK', jsonb_build_object('id', NEW.id));

    IF v_role = 'admin' AND v_store_name IS NOT NULL THEN
      INSERT INTO stores (name, owner_id) VALUES (v_store_name, NEW.id) RETURNING id INTO v_store_id;
      UPDATE users SET store_id = v_store_id WHERE id = NEW.id;
    END IF;

    IF v_status = 'approved' AND v_referred_by IS NOT NULL THEN
      UPDATE users
      SET store_id = (SELECT store_id FROM users WHERE id = v_referred_by)
      WHERE id = NEW.id;
    END IF;

    RETURN NEW;

  EXCEPTION WHEN OTHERS THEN
    v_err_msg := SQLERRM;
    INSERT INTO debug_logs (message, details)
    VALUES ('handle_new_user: EXCEPTION',
      jsonb_build_object(
        'sqlerrm', v_err_msg,
        'sqlstate', SQLSTATE,
        'id', NEW.id,
        'email', NEW.email,
        'role', v_role,
        'full_name', v_full_name,
        'status', v_status
      )
    );
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Migration: 20240009_fix_user_roles_and_triggers
-- Description: Corrige le trigger handle_new_user pour respecter le statut explicite,
--              ajoute la fonction update_user_role pour sync auth.users
-- ============================================================

-- 1. Fonction pour mettre à jour le rôle dans auth.users (via service_role / admin)
CREATE OR REPLACE FUNCTION update_user_role(p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Mettre à jour raw_user_meta_data dans auth.users
  UPDATE auth.users 
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_role),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id;
END;
$$;

-- 2. Corriger handle_new_user pour respecter le statut explicite dans metadata
-- Si status='approved' est explicitement passé (ex: création par un manager), on le respecte
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
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employer');
  v_explicit_status := NEW.raw_user_meta_data->>'status';
  v_referred_by_email := NEW.raw_user_meta_data->>'referred_by_email';
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_store_name := NEW.raw_user_meta_data->>'store_name';
  
  -- Si un statut explicite est fourni (ex: approved par un manager), le respecter
  IF v_explicit_status IS NOT NULL THEN
    v_status := v_explicit_status;
  ELSE
    -- Sinon, comportement par défaut
    IF v_role IN ('employer', 'magasinier') THEN
      v_status := 'pending';
    ELSE
      v_status := 'approved';
    END IF;
  END IF;
  
  -- Chercher le manager/admin par email si référence fournie
  IF v_referred_by_email IS NOT NULL THEN
    SELECT id INTO v_referred_by 
    FROM users 
    WHERE email = v_referred_by_email 
    AND role IN ('admin', 'magasinier')
    LIMIT 1;
  END IF;
  
  -- Si c'est un admin qui s'inscrit seul, role=admin
  IF v_role NOT IN ('admin', 'magasinier', 'employer') THEN
    v_role := 'admin';
    v_status := 'approved';
  END IF;
  
  -- Insérer dans la table users
  INSERT INTO public.users (
    id, 
    email, 
    role, 
    full_name, 
    status,
    referred_by,
    referred_by_email
  ) VALUES (
    NEW.id,
    NEW.email,
    v_role,
    v_full_name,
    v_status,
    v_referred_by,
    v_referred_by_email
  );

  -- If Admin, create store and update user
  IF v_role = 'admin' AND v_store_name IS NOT NULL THEN
    INSERT INTO stores (name, owner_id) VALUES (v_store_name, NEW.id) RETURNING id INTO v_store_id;
    UPDATE users SET store_id = v_store_id WHERE id = NEW.id;
  END IF;

  -- Si créé par un manager et approved, lier au store du manager
  IF v_status = 'approved' AND v_referred_by IS NOT NULL THEN
    UPDATE users 
    SET store_id = (SELECT store_id FROM users WHERE id = v_referred_by)
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Mettre à jour la RLS policy users_select pour permettre aux admins de voir les pending users
DROP POLICY IF EXISTS "users_select" ON users;
CREATE POLICY "users_select" ON users FOR SELECT
  USING (
    auth.uid() = id 
    OR get_user_role(auth.uid()) = 'admin' 
    OR (get_user_role(auth.uid()) = 'magasinier' AND store_id = (SELECT store_id FROM users WHERE id = auth.uid()))
    OR (get_user_role(auth.uid()) = 'magasinier' AND referred_by = auth.uid())
  );

-- 4. Ajouter un index sur referred_by pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

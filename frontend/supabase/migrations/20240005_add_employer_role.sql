-- ============================================================
-- Migration: 20240005_add_employer_role
-- Description: Ajouter rôle employer avec système d'approbation
-- ============================================================

-- Ajouter colonnes à la table users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS referred_by_email TEXT;

-- Mettre à jour les utilisateurs existants à 'approved'
UPDATE users SET status = 'approved' WHERE status IS NULL;

-- Corriger le CHECK constraint sur role pour inclure 'employer'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'magasinier', 'employer'));

-- Modifier la fonction handle_new_user pour gérer les rôles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
  v_referred_by UUID;
  v_referred_by_email TEXT;
  v_full_name TEXT;
BEGIN
  -- Récupérer les données du metadata
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'magasinier');
  v_status := COALESCE(NEW.raw_user_meta_data->>'status', 'approved');
  v_referred_by_email := NEW.raw_user_meta_data->>'referred_by_email';
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  
  -- Si c'est un employé (employer), le statut est pending par défaut
  IF v_role = 'employer' THEN
    v_status := 'pending';
    
    -- Chercher le manager/admin par email
    IF v_referred_by_email IS NOT NULL THEN
      SELECT id INTO v_referred_by 
      FROM users 
      WHERE email = v_referred_by_email 
      AND role IN ('admin', 'magasinier')
      LIMIT 1;
    END IF;
  ELSE
    -- Manager (magasinier) est approuvé directement
    v_status := 'approved';
    v_referred_by := NULL;
    v_referred_by_email := NULL;
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mise à jour des policies RLS pour inclure le nouveau rôle

-- Policy pour les employés : ils ne peuvent voir que leur propre profil
DROP POLICY IF EXISTS "users_select" ON users;

CREATE POLICY "users_select" ON users FOR SELECT
  USING (
    auth.uid() = id 
    OR get_user_role(auth.uid()) = 'admin' 
    OR get_user_role(auth.uid()) = 'magasinier'
  );

-- Policy pour update : admin et magasinier peuvent modifier
DROP POLICY IF EXISTS "users_update" ON users;

CREATE POLICY "users_update" ON users FOR UPDATE
  USING (get_user_role(auth.uid()) IN ('admin', 'magasinier'));

-- Créer une fonction pour approuver/rejeter un employé
CREATE OR REPLACE FUNCTION approve_employer(p_user_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approver_role TEXT;
BEGIN
  -- Vérifier que l'approbateur est admin ou magasinier
  SELECT role INTO v_approver_role FROM users WHERE id = auth.uid();
  
  IF v_approver_role NOT IN ('admin', 'magasinier') THEN
    RAISE EXCEPTION 'Seuls les managers peuvent approuver les employés';
  END IF;
  
  -- Vérifier que le statut est valide
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Statut invalide';
  END IF;
  
  -- Mettre à jour le statut
  UPDATE users 
  SET status = p_status,
      referred_by = auth.uid()
  WHERE id = p_user_id 
  AND role = 'employer';
  
END;
$$;

-- Créer une fonction pour ajouter un employé directement (par manager)
CREATE OR REPLACE FUNCTION add_employer_by_manager(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_manager_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_manager_role TEXT;
BEGIN
  -- Vérifier que le créateur est admin ou magasinier
  SELECT role INTO v_manager_role FROM users WHERE id = p_manager_id;
  
  IF v_manager_role NOT IN ('admin', 'magasinier') THEN
    RAISE EXCEPTION 'Seuls les managers peuvent ajouter des employés';
  END IF;
  
  -- Créer l'utilisateur dans auth.users
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'role', 'employer',
      'status', 'approved',
      'full_name', p_full_name,
      'referred_by_email', (SELECT email FROM users WHERE id = p_manager_id)
    ),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_user_id;
  
  -- Le trigger handle_new_user va créer l'entrée dans public.users
  
  RETURN v_user_id;
END;
$$;

COMMENT ON TABLE users IS 'Table des utilisateurs avec rôles: admin, magasinier (manager), employer (employé)';
COMMENT ON COLUMN users.status IS 'Statut: pending (en attente), approved (approuvé), rejected (rejeté)';
COMMENT ON COLUMN users.referred_by IS 'ID du manager qui a référencé/approuvé l employé';
COMMENT ON COLUMN users.referred_by_email IS 'Email du manager référent (pour les employés en attente)';

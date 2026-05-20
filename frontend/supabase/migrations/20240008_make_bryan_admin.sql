-- ============================================================
-- Migration: 20240008_make_bryan_admin
-- Description: Changer le rôle de l'utilisateur bryanmfb4@gmail.com en admin
-- ============================================================

-- Mettre à jour le rôle de l'utilisateur dans la table users
UPDATE users 
SET role = 'admin',
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'bryanmfb4@gmail.com';

-- Mettre à jour les métadonnées dans auth.users pour maintenir la cohérence
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'bryanmfb4@gmail.com';

-- Vérification : afficher un message si l'utilisateur n'existe pas
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM users WHERE email = 'bryanmfb4@gmail.com';
  IF v_count = 0 THEN
    RAISE NOTICE 'AVERTISSEMENT: Utilisateur bryanmfb4@gmail.com non trouvé dans la table users';
  ELSE
    RAISE NOTICE 'SUCCES: Utilisateur bryanmfb4@gmail.com est maintenant admin';
  END IF;
  
  SELECT COUNT(*) INTO v_count FROM auth.users WHERE email = 'bryanmfb4@gmail.com';
  IF v_count = 0 THEN
    RAISE NOTICE 'AVERTISSEMENT: Utilisateur bryanmfb4@gmail.com non trouvé dans auth.users';
  END IF;
END $$;

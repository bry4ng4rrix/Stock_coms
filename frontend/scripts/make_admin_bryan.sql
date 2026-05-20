-- ============================================================
-- Script: make_admin_bryan.sql
-- Description: Changer le rôle de l'utilisateur bryanmfb4@gmail.com en admin
-- Usage: Executer directement dans le SQL Editor de Supabase ou via psql
-- ============================================================

-- 1. Mettre à jour le rôle dans la table users (table publique)
UPDATE public.users 
SET role = 'admin',
    status = 'approved',  -- S'assurer que le statut est approuvé
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'bryanmfb4@gmail.com';

-- 2. Mettre à jour les métadonnées dans auth.users (pour cohérence)
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin", "status": "approved"}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'bryanmfb4@gmail.com';

-- 3. Vérification
SELECT 
  u.id,
  u.email,
  u.role,
  u.status,
  u.full_name,
  u.updated_at
FROM public.users u
WHERE u.email = 'bryanmfb4@gmail.com';

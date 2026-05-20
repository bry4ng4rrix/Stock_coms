-- ============================================================
-- Migration: 20240027_set_superadmin_roles
-- Description: Set bryanmfb4@gmail.com as superadmin and bryanmfb4@outlook.com as admin
-- ============================================================

-- Set bryanmfb4@gmail.com as superadmin
UPDATE users 
SET role = 'superadmin', status = 'approved'
WHERE email = 'bryanmfb4@gmail.com';

-- Update auth metadata for bryanmfb4@gmail.com
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', 'superadmin')
WHERE email = 'bryanmfb4@gmail.com';

-- Set bryanmfb4@outlook.com as admin (keep as admin if already admin)
UPDATE users 
SET role = 'admin', status = 'approved'
WHERE email = 'bryanmfb4@outlook.com';

-- Update auth metadata for bryanmfb4@outlook.com
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', 'admin')
WHERE email = 'bryanmfb4@outlook.com';

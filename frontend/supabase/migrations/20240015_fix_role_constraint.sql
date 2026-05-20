-- ============================================================
-- Migration: 20240015_fix_role_constraint
-- Description: Supprime toutes les contraintes CHECK sur role
--              et recrée la bonne incluant 'employer'
-- ============================================================

-- Supprimer TOUTES les contraintes CHECK liées à la colonne role
-- (l'originale auto-générée par CREATE TABLE peut avoir un nom différent)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE 'ALTER TABLE users DROP CONSTRAINT IF EXISTS ' || quote_ident(rec.conname);
  END LOOP;
END $$;

-- Recréer la contrainte correcte avec les 3 rôles
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'magasinier', 'employer'));

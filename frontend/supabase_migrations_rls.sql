-- ═══════════════════════════════════════════════════════════════
-- MIGRATION COMPLÈTE — Akanjo Stock Management
-- Coller ENTIÈREMENT dans : Supabase Dashboard → SQL Editor → Run
--
-- FIX PRINCIPAL : "infinite recursion detected in policy for relation users"
--   Cause  : get_user_role() en LANGUAGE sql peut être inlinée par le
--             planificateur PostgreSQL → perd son contexte SECURITY DEFINER
--             → la policy users appelle get_user_role() → query sur users
--             → déclenche encore la policy → boucle infinie.
--   Solution : 1) LANGUAGE plpgsql sur toutes les fonctions SECURITY DEFINER
--                 (plpgsql n'est jamais inliné → SECURITY DEFINER toujours actif)
--              2) jwt_role() pour les policies de la table USERS elle-même
--                 (lit le JWT sans aucune requête SQL → zéro récursion possible)
-- ═══════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────
-- ÉTAPE 0 : Colonnes manquantes sur users
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS store_name        TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS store_logo        TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by_email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS superadmin_email  TEXT;


-- ───────────────────────────────────────────────────────────────
-- ÉTAPE 1 : Trigger — auto-création du profil à l'inscription
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id, email, full_name, role, status,
    store_name, store_logo, referred_by_email, superadmin_email
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role',      'employer'),
    COALESCE(NEW.raw_user_meta_data->>'status',    'pending'),
    NEW.raw_user_meta_data->>'store_name',
    NEW.raw_user_meta_data->>'store_logo',
    NEW.raw_user_meta_data->>'referred_by_email',
    NEW.raw_user_meta_data->>'superadmin_email'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name         = EXCLUDED.full_name,
    role              = EXCLUDED.role,
    status            = EXCLUDED.status,
    store_name        = COALESCE(EXCLUDED.store_name,        public.users.store_name),
    store_logo        = COALESCE(EXCLUDED.store_logo,        public.users.store_logo),
    referred_by_email = COALESCE(EXCLUDED.referred_by_email, public.users.referred_by_email),
    superadmin_email  = COALESCE(EXCLUDED.superadmin_email,  public.users.superadmin_email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ───────────────────────────────────────────────────────────────
-- ÉTAPE 2 : Fonctions SECURITY DEFINER — LANGUAGE plpgsql obligatoire
--
-- POURQUOI plpgsql ?
--   PostgreSQL peut "inliner" les fonctions LANGUAGE sql dans la requête
--   appelante. Quand c'est inlinée, le contexte SECURITY DEFINER est perdu
--   et la fonction s'exécute comme l'utilisateur connecté (anon/authenticated)
--   → RLS s'applique → récursion si la table appelée est "users".
--   Les fonctions plpgsql ne sont JAMAIS inlinées → SECURITY DEFINER garanti.
-- ───────────────────────────────────────────────────────────────

-- Rôle de l'utilisateur courant (via public.users — SECURITY DEFINER bypass RLS)
-- Utiliser pour toutes les tables SAUF users (voir jwt_role() ci-dessous)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'employer');
END;
$$;

-- store_id de l'utilisateur courant (via public.users — SECURITY DEFINER bypass RLS)
CREATE OR REPLACE FUNCTION public.get_user_store_id()
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  SELECT store_id INTO v_id FROM public.users WHERE id = auth.uid();
  RETURN v_id;
END;
$$;

-- !! FONCTION ANTI-RÉCURSION pour la table USERS !!
-- Lit le rôle depuis le JWT Supabase — AUCUNE requête SQL, zéro récursion.
-- À utiliser UNIQUEMENT dans les policies de la table public.users.
-- Limite : le JWT est émis à la connexion ; si le rôle est modifié en base,
-- l'utilisateur doit se reconnecter pour que jwt_role() reflète le nouveau rôle.
-- En pratique c'est acceptable (les rôles changent rarement).
CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    auth.jwt()->'user_metadata'->>'role',
    'employer'
  );
$$;


-- ═══════════════════════════════════════════════════════════════
-- TABLE : users
-- IMPORTANT : utilise jwt_role() et NON get_user_role()
--             pour éviter toute récursion
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users NO FORCE ROW LEVEL SECURITY;  -- permet au superuser postgres de bypass

DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select" ON public.users FOR SELECT
  USING (
    id = auth.uid()                                                       -- voit son propre profil
    OR public.jwt_role() = 'superadmin'                                   -- superadmin : tout
    OR (
      public.jwt_role() = 'admin'
      AND store_id = public.get_user_store_id()                           -- admin : son magasin
    )
  );

-- Insertion libre — nécessaire pour le trigger handle_new_user
DROP POLICY IF EXISTS "users_insert" ON public.users;
CREATE POLICY "users_insert" ON public.users FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update" ON public.users FOR UPDATE
  USING (
    id = auth.uid()
    OR public.jwt_role() IN ('admin', 'superadmin')
  );

DROP POLICY IF EXISTS "users_delete" ON public.users;
CREATE POLICY "users_delete" ON public.users FOR DELETE
  USING (public.jwt_role() IN ('admin', 'superadmin'));


-- ═══════════════════════════════════════════════════════════════
-- TABLE : stores
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stores_select" ON public.stores;
CREATE POLICY "stores_select" ON public.stores FOR SELECT
  USING (
    public.get_user_role() = 'superadmin'
    OR id = public.get_user_store_id()
  );

-- Admin peut créer un magasin (page paramètres, premier magasin)
-- Superadmin peut créer depuis la page magasins
DROP POLICY IF EXISTS "stores_insert" ON public.stores;
CREATE POLICY "stores_insert" ON public.stores FOR INSERT
  WITH CHECK (public.get_user_role() IN ('superadmin', 'admin'));

DROP POLICY IF EXISTS "stores_update" ON public.stores;
CREATE POLICY "stores_update" ON public.stores FOR UPDATE
  USING (
    public.get_user_role() = 'superadmin'
    OR id = public.get_user_store_id()
  );

DROP POLICY IF EXISTS "stores_delete" ON public.stores;
CREATE POLICY "stores_delete" ON public.stores FOR DELETE
  USING (public.get_user_role() = 'superadmin');


-- ═══════════════════════════════════════════════════════════════
-- TABLE : products
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT
  USING (
    public.get_user_role() = 'superadmin'
    OR store_id = public.get_user_store_id()
  );

DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert" ON public.products FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'superadmin'
    OR (
      public.get_user_role() = 'admin'
      AND store_id = public.get_user_store_id()
    )
  );

DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update" ON public.products FOR UPDATE
  USING (
    public.get_user_role() = 'superadmin'
    OR (
      public.get_user_role() = 'admin'
      AND store_id = public.get_user_store_id()
    )
  )
  WITH CHECK (public.get_user_role() IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_delete" ON public.products FOR DELETE
  USING (
    public.get_user_role() = 'superadmin'
    OR (
      public.get_user_role() = 'admin'
      AND store_id = public.get_user_store_id()
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- TABLE : suppliers
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT
  USING (
    public.get_user_role() = 'superadmin'
    OR store_id = public.get_user_store_id()
  );

DROP POLICY IF EXISTS "suppliers_insert" ON public.suppliers;
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT
  WITH CHECK (public.get_user_role() IN ('superadmin', 'admin'));

DROP POLICY IF EXISTS "suppliers_update" ON public.suppliers;
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE
  USING (
    public.get_user_role() = 'superadmin'
    OR (
      public.get_user_role() = 'admin'
      AND store_id = public.get_user_store_id()
    )
  )
  WITH CHECK (public.get_user_role() IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS "suppliers_delete" ON public.suppliers;
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE
  USING (
    public.get_user_role() = 'superadmin'
    OR (
      public.get_user_role() = 'admin'
      AND store_id = public.get_user_store_id()
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- TABLE : stock_movements
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_movements_select" ON public.stock_movements;
CREATE POLICY "stock_movements_select" ON public.stock_movements FOR SELECT
  USING (
    public.get_user_role() = 'superadmin'
    OR (
      public.get_user_role() = 'admin'
      AND product_id IN (
        SELECT id FROM public.products WHERE store_id = public.get_user_store_id()
      )
    )
    OR (
      public.get_user_role() IN ('employer', 'magasinier')
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "stock_movements_insert" ON public.stock_movements;
CREATE POLICY "stock_movements_insert" ON public.stock_movements FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.get_user_role() = 'superadmin'
      OR product_id IN (
        SELECT id FROM public.products WHERE store_id = public.get_user_store_id()
      )
    )
  );

DROP POLICY IF EXISTS "stock_movements_update" ON public.stock_movements;
CREATE POLICY "stock_movements_update" ON public.stock_movements FOR UPDATE
  USING (public.get_user_role() IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS "stock_movements_delete" ON public.stock_movements;
CREATE POLICY "stock_movements_delete" ON public.stock_movements FOR DELETE
  USING (public.get_user_role() IN ('admin', 'superadmin'));


-- ═══════════════════════════════════════════════════════════════
-- TABLE : notifications
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT
  USING (
    public.get_user_role() = 'superadmin'
    OR store_id = public.get_user_store_id()
  );

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'superadmin'
    OR store_id = public.get_user_store_id()
  );

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
  USING (
    public.get_user_role() = 'superadmin'
    OR store_id = public.get_user_store_id()
  );


-- ═══════════════════════════════════════════════════════════════
-- TABLE : product_images
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_images_select" ON public.product_images;
CREATE POLICY "product_images_select" ON public.product_images FOR SELECT
  USING (
    public.get_user_role() = 'superadmin'
    OR product_id IN (
      SELECT id FROM public.products WHERE store_id = public.get_user_store_id()
    )
  );

DROP POLICY IF EXISTS "product_images_insert" ON public.product_images;
CREATE POLICY "product_images_insert" ON public.product_images FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'superadmin'
    OR (
      public.get_user_role() = 'admin'
      AND product_id IN (
        SELECT id FROM public.products WHERE store_id = public.get_user_store_id()
      )
    )
  );

DROP POLICY IF EXISTS "product_images_delete" ON public.product_images;
CREATE POLICY "product_images_delete" ON public.product_images FOR DELETE
  USING (
    public.get_user_role() = 'superadmin'
    OR (
      public.get_user_role() = 'admin'
      AND product_id IN (
        SELECT id FROM public.products WHERE store_id = public.get_user_store_id()
      )
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- TABLE : product_sizes
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.product_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sizes NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_sizes_select" ON public.product_sizes;
CREATE POLICY "product_sizes_select" ON public.product_sizes FOR SELECT
  USING (
    public.get_user_role() = 'superadmin'
    OR product_id IN (
      SELECT id FROM public.products WHERE store_id = public.get_user_store_id()
    )
  );

DROP POLICY IF EXISTS "product_sizes_insert" ON public.product_sizes;
CREATE POLICY "product_sizes_insert" ON public.product_sizes FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'superadmin'
    OR (
      public.get_user_role() = 'admin'
      AND product_id IN (
        SELECT id FROM public.products WHERE store_id = public.get_user_store_id()
      )
    )
  );

DROP POLICY IF EXISTS "product_sizes_update" ON public.product_sizes;
CREATE POLICY "product_sizes_update" ON public.product_sizes FOR UPDATE
  USING (
    public.get_user_role() = 'superadmin'
    OR product_id IN (
      SELECT id FROM public.products WHERE store_id = public.get_user_store_id()
    )
  );

DROP POLICY IF EXISTS "product_sizes_delete" ON public.product_sizes;
CREATE POLICY "product_sizes_delete" ON public.product_sizes FOR DELETE
  USING (
    public.get_user_role() = 'superadmin'
    OR (
      public.get_user_role() = 'admin'
      AND product_id IN (
        SELECT id FROM public.products WHERE store_id = public.get_user_store_id()
      )
    )
  );

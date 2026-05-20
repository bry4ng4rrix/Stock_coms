-- ============================================================
-- Migration: 20240006_multi_tenant_and_notifications
-- Description: Adds multi-tenancy (stores), notifications, product expiration
-- ============================================================

-- 1. Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add store_id to all relevant tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

-- 3. Add expiration date to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiration_date DATE;

-- 4. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- If null, for all in store
  type TEXT NOT NULL, -- 'approval_request', 'stock_alert', 'expiration_alert', 'system'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  related_entity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Modify handle_new_user to handle store creation
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
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employer');
  v_status := COALESCE(NEW.raw_user_meta_data->>'status', 'approved');
  v_referred_by_email := NEW.raw_user_meta_data->>'referred_by_email';
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_store_name := NEW.raw_user_meta_data->>'store_name';
  
  -- Si c'est un employé ou magasinier avec un admin
  IF v_role IN ('employer', 'magasinier') THEN
    v_status := 'pending';
  ELSE
    v_status := 'approved';
    v_role := 'admin';
  END IF;
  
  -- Insert user
  INSERT INTO public.users (
    id, email, role, full_name, status, referred_by_email
  ) VALUES (
    NEW.id, NEW.email, v_role, v_full_name, v_status, v_referred_by_email
  );

  -- If Admin, create store and update user
  IF v_role = 'admin' AND v_store_name IS NOT NULL THEN
    INSERT INTO stores (name, owner_id) VALUES (v_store_name, NEW.id) RETURNING id INTO v_store_id;
    UPDATE users SET store_id = v_store_id WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger for approval notification
CREATE OR REPLACE FUNCTION notify_admin_on_pending_user()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_store_id UUID;
BEGIN
  IF NEW.status = 'pending' AND NEW.referred_by_email IS NOT NULL THEN
    -- Get admin info
    SELECT id, store_id INTO v_admin_id, v_store_id
    FROM users 
    WHERE email = NEW.referred_by_email AND role = 'admin'
    LIMIT 1;
    
    IF v_admin_id IS NOT NULL THEN
      INSERT INTO notifications (store_id, user_id, type, title, message, related_entity_id)
      VALUES (
        v_store_id, 
        v_admin_id, 
        'approval_request', 
        'Nouvelle demande d''accès', 
        NEW.full_name || ' demande l''accès en tant que ' || NEW.role, 
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_admin_on_pending_user ON users;
CREATE TRIGGER trg_notify_admin_on_pending_user
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION notify_admin_on_pending_user();

-- 7. Function to approve user and set store_id
CREATE OR REPLACE FUNCTION approve_user_request(p_user_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approver_role TEXT;
  v_approver_store_id UUID;
BEGIN
  SELECT role, store_id INTO v_approver_role, v_approver_store_id FROM users WHERE id = auth.uid();
  
  IF v_approver_role NOT IN ('admin', 'magasinier') THEN
    RAISE EXCEPTION 'Seuls les managers peuvent approuver';
  END IF;
  
  UPDATE users 
  SET status = p_status,
      store_id = v_approver_store_id,
      referred_by = auth.uid()
  WHERE id = p_user_id;

  -- Create notification for the approved user
  INSERT INTO notifications (store_id, user_id, type, title, message, related_entity_id)
  VALUES (
    v_approver_store_id, 
    p_user_id, 
    'system', 
    'Demande traitée', 
    'Votre demande a été ' || p_status, 
    auth.uid()
  );
END;
$$;

-- ============================================================
-- Migration: 20240007_triggers_and_admin
-- Description: Mettre bryanmfb4@gmail.com admin, triggers pour mouvements et stock
-- ============================================================

-- 1. Mettre bryanmfb4@gmail.com en admin et s'assurer qu'il a un magasin
DO $$
DECLARE
  v_admin_id UUID;
  v_store_id UUID;
BEGIN
  -- Mettre à jour le rôle
  UPDATE users 
  SET role = 'admin', status = 'approved'
  WHERE email = 'bryanmfb4@gmail.com'
  RETURNING id INTO v_admin_id;

  -- Si l'utilisateur existe, vérifier s'il a un magasin, sinon en créer un
  IF v_admin_id IS NOT NULL THEN
    SELECT store_id INTO v_store_id FROM users WHERE id = v_admin_id;
    
    IF v_store_id IS NULL THEN
      INSERT INTO stores (name, owner_id) 
      VALUES ('Magasin Principal', v_admin_id) 
      RETURNING id INTO v_store_id;
      
      UPDATE users SET store_id = v_store_id WHERE id = v_admin_id;
    END IF;
  END IF;
END $$;

-- 2. Trigger pour générer une notification à chaque mouvement de stock
CREATE OR REPLACE FUNCTION notify_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
  v_store_id UUID;
  v_user_name TEXT;
  v_action TEXT;
BEGIN
  -- Récupérer le nom du produit et le store_id
  SELECT name, store_id INTO v_product_name, v_store_id
  FROM products WHERE id = NEW.product_id;

  -- Récupérer le nom de l'utilisateur qui a fait le mouvement
  SELECT full_name INTO v_user_name
  FROM users WHERE id = NEW.user_id;

  IF v_user_name IS NULL THEN
    v_user_name := 'Système';
  END IF;

  IF NEW.type = 'entry' THEN
    v_action := 'Entrée';
  ELSE
    v_action := 'Sortie';
  END IF;

  IF v_store_id IS NOT NULL THEN
    INSERT INTO notifications (store_id, type, title, message, related_entity_id)
    VALUES (
      v_store_id, 
      'system', 
      v_action || ' de stock : ' || v_product_name, 
      v_action || ' de ' || NEW.quantity || ' unité(s) effectuée par ' || v_user_name || COALESCE('. Notes: ' || NEW.notes, ''),
      NEW.product_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_stock_movement ON stock_movements;
CREATE TRIGGER trg_notify_stock_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION notify_stock_movement();

-- 3. Trigger pour générer une notification quand le stock devient faible ou en rupture
CREATE OR REPLACE FUNCTION notify_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Si la quantité passe sous le seuil de réapprovisionnement ou devient 0
  IF (NEW.quantity <= NEW.reorder_level AND OLD.quantity > NEW.reorder_level) 
     OR (NEW.quantity = 0 AND OLD.quantity > 0) THEN
    
    INSERT INTO notifications (store_id, type, title, message, related_entity_id)
    VALUES (
      NEW.store_id, 
      'stock_alert', 
      CASE WHEN NEW.quantity = 0 THEN 'Rupture de stock : ' ELSE 'Stock faible : ' END || NEW.name, 
      'Le produit ' || NEW.name || ' (SKU: ' || NEW.sku || ') est maintenant à ' || NEW.quantity || ' unité(s).',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_low_stock ON products;
CREATE TRIGGER trg_notify_low_stock
  AFTER UPDATE OF quantity ON products
  FOR EACH ROW EXECUTE FUNCTION notify_low_stock();

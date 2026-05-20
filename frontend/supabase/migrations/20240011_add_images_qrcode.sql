-- ============================================================
-- Migration: 20240011_add_images_qrcode.sql
-- Description: Add product images, QR codes and low stock alerts
-- ============================================================

-- Create product_images table for storing images with QR codes
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  qr_code_data TEXT NOT NULL, -- Stores SKU + Image ID for identification
  qr_code_image TEXT, -- Base64 encoded QR code image
  size TEXT CHECK (size IN ('S', 'M', 'XL', 'XXL')),
  color_variant TEXT, -- e.g., "Red", "Blue", etc.
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create stock_alerts table for low stock notifications
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  product_size_id UUID REFERENCES product_sizes(id) ON DELETE CASCADE,
  size TEXT CHECK (size IN ('S', 'M', 'XL', 'XXL')),
  alert_type TEXT CHECK (alert_type IN ('low_stock', 'out_of_stock', 'reorder')) DEFAULT 'low_stock',
  current_quantity INTEGER NOT NULL,
  reorder_level INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create product_stats table for performance tracking
CREATE TABLE IF NOT EXISTS product_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  size TEXT CHECK (size IN ('S', 'M', 'XL', 'XXL')),
  total_sold INTEGER DEFAULT 0,
  total_purchased INTEGER DEFAULT 0,
  last_movement_at TIMESTAMP WITH TIME ZONE,
  movement_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, size)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_qr_code ON product_images(qr_code_data);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_active ON stock_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_product_stats_product ON product_stats(product_id);

-- Enable RLS on new tables
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_images
CREATE POLICY "allow_read_product_images" ON product_images FOR SELECT USING (true);
CREATE POLICY "allow_insert_product_images" ON product_images FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "allow_update_product_images" ON product_images FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "allow_delete_product_images" ON product_images FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for stock_alerts
CREATE POLICY "allow_read_stock_alerts" ON stock_alerts FOR SELECT USING (true);
CREATE POLICY "allow_insert_stock_alerts" ON stock_alerts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "allow_update_stock_alerts" ON stock_alerts FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for product_stats
CREATE POLICY "allow_read_product_stats" ON product_stats FOR SELECT USING (true);
CREATE POLICY "allow_insert_product_stats" ON product_stats FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "allow_update_product_stats" ON product_stats FOR UPDATE USING (auth.role() = 'authenticated');

-- Trigger function to create stock alert when quantity is low
CREATE OR REPLACE FUNCTION create_stock_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity <= NEW.reorder_level THEN
    INSERT INTO stock_alerts (
      product_id, 
      product_size_id, 
      size, 
      alert_type, 
      current_quantity, 
      reorder_level, 
      is_active
    )
    VALUES (
      NEW.product_id, 
      NEW.id, 
      NEW.size, 
      CASE 
        WHEN NEW.quantity = 0 THEN 'out_of_stock'::text
        ELSE 'low_stock'::text
      END, 
      NEW.quantity, 
      NEW.reorder_level, 
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for product_sizes to create alerts automatically
DROP TRIGGER IF EXISTS trigger_create_stock_alert ON product_sizes;
CREATE TRIGGER trigger_create_stock_alert
AFTER INSERT OR UPDATE ON product_sizes
FOR EACH ROW
EXECUTE FUNCTION create_stock_alert();

-- Function to update product stats after movements
CREATE OR REPLACE FUNCTION update_product_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO product_stats (
    product_id,
    size,
    total_sold,
    total_purchased,
    last_movement_at,
    movement_count
  )
  VALUES (
    NEW.product_id,
    COALESCE(NEW.size, 'S'),
    CASE WHEN NEW.type = 'exit' THEN ABS(NEW.quantity) ELSE 0 END,
    CASE WHEN NEW.type = 'entry' THEN NEW.quantity ELSE 0 END,
    NOW(),
    1
  )
  ON CONFLICT (product_id, size) DO UPDATE SET
    total_sold = CASE WHEN NEW.type = 'exit' THEN product_stats.total_sold + ABS(NEW.quantity) ELSE product_stats.total_sold END,
    total_purchased = CASE WHEN NEW.type = 'entry' THEN product_stats.total_purchased + NEW.quantity ELSE product_stats.total_purchased END,
    last_movement_at = NOW(),
    movement_count = product_stats.movement_count + 1,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for stock_movements
DROP TRIGGER IF EXISTS trigger_update_product_stats ON stock_movements;
CREATE TRIGGER trigger_update_product_stats
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION update_product_stats();

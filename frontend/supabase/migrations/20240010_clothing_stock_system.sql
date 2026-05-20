-- ============================================================
-- Migration: 20240010_clothing_stock_system
-- Description: Vêtements Stock Management with Sizes
-- ============================================================

-- Drop old products / stock tables if they exist so we can recreate with clothing fields
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS product_sizes CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Create new products table with clothing-specific fields
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  location TEXT,
  unit_price DECIMAL(10, 2) NOT NULL,
  status TEXT CHECK (status IN ('in_stock', 'low', 'out_of_stock')) DEFAULT 'in_stock',
  color TEXT,
  material TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create product_sizes table (junction table for products and sizes with quantities)
CREATE TABLE product_sizes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  size TEXT NOT NULL CHECK (size IN ('S', 'M', 'XL', 'XXL')),
  quantity INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, size)
);

-- Recreate stock_movements table (should reference product_sizes now)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  product_size_id UUID REFERENCES product_sizes(id) ON DELETE CASCADE,
  size TEXT,
  type TEXT CHECK (type IN ('entry', 'exit')) NOT NULL,
  quantity INTEGER NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Update categories to include fashion categories only
DELETE FROM categories WHERE true;
INSERT INTO categories (name, description) VALUES
  ('Hommes', 'Vêtements pour hommes'),
  ('Femmes', 'Vêtements pour femmes'),
  ('Enfants', 'Vêtements pour enfants');

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_product_sizes_product ON product_sizes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_sizes_size ON product_sizes(size);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_size ON stock_movements(product_size_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all products
CREATE POLICY "allow_read_products" ON products FOR SELECT USING (true);
CREATE POLICY "allow_insert_products" ON products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "allow_update_products" ON products FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "allow_delete_products" ON products FOR DELETE USING (auth.role() = 'authenticated');

-- Allow authenticated users to read all product_sizes
CREATE POLICY "allow_read_product_sizes" ON product_sizes FOR SELECT USING (true);
CREATE POLICY "allow_insert_product_sizes" ON product_sizes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "allow_update_product_sizes" ON product_sizes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "allow_delete_product_sizes" ON product_sizes FOR DELETE USING (auth.role() = 'authenticated');

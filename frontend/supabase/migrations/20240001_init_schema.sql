-- ============================================================
-- Migration: 20240001_init_schema
-- Description: Initial database schema (users, categories, suppliers, products, stock_movements, audit_logs)
-- ============================================================

-- Cleanup existing objects for idempotency (reset mode)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'magasinier')) DEFAULT 'magasinier',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT,
  contact_person TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  location TEXT,
  quantity INTEGER DEFAULT 0,
  unit_price DECIMAL(10, 2) NOT NULL,
  reorder_level INTEGER DEFAULT 10,
  status TEXT CHECK (status IN ('in_stock', 'low', 'out_of_stock')) DEFAULT 'in_stock',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stock movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('entry', 'exit')) NOT NULL,
  quantity INTEGER NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_category     ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier     ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_sku          ON products(sku);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product    ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user       ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user       ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email           ON users(email);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs      ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "users_select" ON users FOR SELECT
  USING (auth.uid() = id OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "users_update" ON users FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- products
CREATE POLICY "products_select" ON products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "products_insert" ON products FOR INSERT
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "products_update" ON products FOR UPDATE
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "products_delete" ON products FOR DELETE
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- stock_movements
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- suppliers
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- categories
CREATE POLICY "categories_select" ON categories FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "categories_insert" ON categories FOR INSERT
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- audit_logs
CREATE POLICY "audit_logs_select_authenticated" ON audit_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "audit_logs_select_admin" ON audit_logs FOR SELECT
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ── Auto-update updated_at trigger ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Auto-create user profile on signup ───────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

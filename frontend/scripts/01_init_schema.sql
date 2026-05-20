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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for products (all authenticated users can read)
CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can insert products"
  ON products FOR INSERT
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Only admins can update products"
  ON products FOR UPDATE
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Only admins can delete products"
  ON products FOR DELETE
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- RLS Policies for stock_movements
CREATE POLICY "Authenticated users can view stock movements"
  ON stock_movements FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert stock movements"
  ON stock_movements FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for suppliers
CREATE POLICY "Authenticated users can view suppliers"
  ON suppliers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can modify suppliers"
  ON suppliers FOR INSERT
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- RLS Policies for categories
CREATE POLICY "Authenticated users can view categories"
  ON categories FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can modify categories"
  ON categories FOR INSERT
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- RLS Policies for audit logs
CREATE POLICY "Authenticated users can view audit logs"
  ON audit_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can view detailed audit logs"
  ON audit_logs FOR SELECT
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

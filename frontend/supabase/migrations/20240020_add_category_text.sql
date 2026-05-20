-- Migration: 20240020_add_category_text
-- Description: Add category text column to products for simple category storage (Homme, Femme, Enfant)

-- Add category text column
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;

-- Make category_id nullable since we'll use category text instead
ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL;

-- Update existing products to set category from categories table
UPDATE products 
SET category = COALESCE(
  (SELECT name FROM categories WHERE categories.id = products.category_id),
  'Homme'
)
WHERE category IS NULL;

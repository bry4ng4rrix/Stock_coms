-- ============================================================
-- Migration: 20240002_seed_data
-- Description: Sample data for categories, suppliers, products, stock_movements
-- ============================================================

INSERT INTO categories (id, name, description) VALUES
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 'Électronique', 'Produits électroniques'),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'Vêtements',   'Vêtements et accessoires'),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 'Alimentaire', 'Produits alimentaires'),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, 'Maison',      'Articles de maison')
ON CONFLICT DO NOTHING;

INSERT INTO suppliers (id, name, email, phone, address, city, postal_code, country, contact_person) VALUES
  ('550e8400-e29b-41d4-a716-446655450001'::uuid, 'TechDistribution SA',  'contact@techdist.fr',      '+33123456789', '123 Rue de la Tech',   'Paris', '75001', 'France', 'Marie Dupont'),
  ('550e8400-e29b-41d4-a716-446655450002'::uuid, 'Fashion Imports Ltd',  'sales@fashionimports.uk',  '+441234567890', '456 Oxford Street',    'London', 'W1A 1AA', 'UK', 'John Smith'),
  ('550e8400-e29b-41d4-a716-446655450003'::uuid, 'FreshFood Wholesale',  'orders@freshfood.com',     '+33456789012', '789 Rue du Marché',    'Lyon', '69000', 'France', 'Pierre Martin')
ON CONFLICT DO NOTHING;

INSERT INTO products (id, sku, name, description, category_id, supplier_id, location, quantity, unit_price, reorder_level, status) VALUES
  ('650e8400-e29b-41d4-a716-446655440001'::uuid, 'LAPTOP-001',  'Ordinateur Portable ProBook 15', 'Ordinateur portable 15 pouces',  '550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655450001'::uuid, 'Rayon A1', 45,  899.99, 10, 'in_stock'),
  ('650e8400-e29b-41d4-a716-446655440002'::uuid, 'MOUSE-001',   'Souris sans fil Bluetooth',      'Souris ergonomique',             '550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655450001'::uuid, 'Rayon A2',  3,   29.99, 15, 'low'),
  ('650e8400-e29b-41d4-a716-446655440003'::uuid, 'SHIRT-001',   'T-shirt coton Premium',          'T-shirt coton 100%',             '550e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655450002'::uuid, 'Rayon B1', 120,  19.99, 50, 'in_stock'),
  ('650e8400-e29b-41d4-a716-446655440004'::uuid, 'JEANS-001',   'Jeans slim fit bleu',            'Jean classique bleu indigo',     '550e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655450002'::uuid, 'Rayon B2',  0,   59.99, 20, 'out_of_stock'),
  ('650e8400-e29b-41d4-a716-446655440005'::uuid, 'COFFEE-001',  'Café moulu Premium 500g',        'Café arabica moulu',             '550e8400-e29b-41d4-a716-446655440003'::uuid, '550e8400-e29b-41d4-a716-446655450003'::uuid, 'Rayon C1', 87,   12.50, 30, 'in_stock'),
  ('650e8400-e29b-41d4-a716-446655440006'::uuid, 'TEA-001',     'Assortiment Thés 25 sachets',    'Sélection de thés variés',       '550e8400-e29b-41d4-a716-446655440003'::uuid, '550e8400-e29b-41d4-a716-446655450003'::uuid, 'Rayon C2',  5,    8.99, 20, 'low'),
  ('650e8400-e29b-41d4-a716-446655440007'::uuid, 'LAMP-001',    'Lampe LED Moderne 40W',          'Lampe de bureau LED',            '550e8400-e29b-41d4-a716-446655440004'::uuid, '550e8400-e29b-41d4-a716-446655450001'::uuid, 'Rayon D1', 34,   45.00, 15, 'in_stock'),
  ('650e8400-e29b-41d4-a716-446655440008'::uuid, 'PILLOW-001',  'Oreiller ergonomique mémoire',   'Oreiller confortable à mémoire', '550e8400-e29b-41d4-a716-446655440004'::uuid, '550e8400-e29b-41d4-a716-446655450002'::uuid, 'Rayon D2', 62,   35.00, 20, 'in_stock')
ON CONFLICT DO NOTHING;

INSERT INTO stock_movements (id, product_id, type, quantity, notes, created_at) VALUES
  ('750e8400-e29b-41d4-a716-446655440001'::uuid, '650e8400-e29b-41d4-a716-446655440001'::uuid, 'entry', 20, 'Réception fournisseur TechDistribution', NOW() - INTERVAL '6 days'),
  ('750e8400-e29b-41d4-a716-446655440002'::uuid, '650e8400-e29b-41d4-a716-446655440003'::uuid, 'exit',  15, 'Vente en ligne',                        NOW() - INTERVAL '5 days'),
  ('750e8400-e29b-41d4-a716-446655440003'::uuid, '650e8400-e29b-41d4-a716-446655440005'::uuid, 'entry', 50, 'Réception FreshFood',                   NOW() - INTERVAL '4 days'),
  ('750e8400-e29b-41d4-a716-446655440004'::uuid, '650e8400-e29b-41d4-a716-446655440002'::uuid, 'exit',  12, 'Vente magasin',                         NOW() - INTERVAL '3 days'),
  ('750e8400-e29b-41d4-a716-446655440005'::uuid, '650e8400-e29b-41d4-a716-446655440007'::uuid, 'entry', 15, 'Réception TechDistribution',            NOW() - INTERVAL '2 days'),
  ('750e8400-e29b-41d4-a716-446655440006'::uuid, '650e8400-e29b-41d4-a716-446655440004'::uuid, 'exit',  25, 'Liquidation stock',                     NOW() - INTERVAL '1 day'),
  ('750e8400-e29b-41d4-a716-446655440007'::uuid, '650e8400-e29b-41d4-a716-446655440008'::uuid, 'entry', 30, 'Réception Fashion Imports',             NOW())
ON CONFLICT DO NOTHING;

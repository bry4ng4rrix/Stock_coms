-- ============================================================
-- Migration: 20240024_add_expiry_date.sql
-- Description: Add expiry_date to products table
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE;

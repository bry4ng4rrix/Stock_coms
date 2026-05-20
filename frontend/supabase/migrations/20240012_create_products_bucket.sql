-- Migration: 20240012_create_products_bucket.sql
-- Description: Create the storage bucket for product images

-- Create products bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for the 'products' bucket
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'products' );

CREATE POLICY "Authenticated users can upload images" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'products' AND auth.role() = 'authenticated' );

CREATE POLICY "Users can update their own images" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'products' AND auth.role() = 'authenticated' );

CREATE POLICY "Users can delete their own images" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'products' AND auth.role() = 'authenticated' );

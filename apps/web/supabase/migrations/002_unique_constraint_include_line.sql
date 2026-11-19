-- Remove the unique constraint that blocks updates when brand+name+length
-- matches another cigar. Run in Supabase Dashboard → SQL Editor.

ALTER TABLE public.cigar_catalog
  DROP CONSTRAINT IF EXISTS cigar_catalog_brand_name_length_key;

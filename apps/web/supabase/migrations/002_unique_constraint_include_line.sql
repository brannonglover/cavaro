-- Include 'line' in the unique constraint so cigars with the same brand+name+length
-- can differ by line (e.g. "Robusto" vs "Toro").
-- Run in Supabase SQL Editor if migrations aren't applied automatically.

ALTER TABLE public.cigar_catalog
  DROP CONSTRAINT IF EXISTS cigar_catalog_brand_name_length_key;

CREATE UNIQUE INDEX cigar_catalog_brand_name_line_length_key
  ON public.cigar_catalog (
    COALESCE(brand, ''),
    COALESCE(name, ''),
    COALESCE(line, ''),
    COALESCE(length, '')
  );

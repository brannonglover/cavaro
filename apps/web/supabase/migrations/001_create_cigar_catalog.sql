-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) if cigar_catalog doesn't exist.
-- Creates the cigar catalog table used by the admin panel.

CREATE TABLE IF NOT EXISTS public.cigar_catalog (
  id BIGSERIAL PRIMARY KEY,
  brand TEXT,
  name TEXT,
  line TEXT,
  description TEXT,
  wrapper TEXT,
  binder TEXT,
  filler TEXT,
  length TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS (optional; service role bypasses it)
ALTER TABLE public.cigar_catalog ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (default for service_role)
-- Add policies if you need anon/authenticated access:
-- CREATE POLICY "Allow public read" ON public.cigar_catalog FOR SELECT USING (true);

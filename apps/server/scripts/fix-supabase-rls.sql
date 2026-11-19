-- Run this in Supabase SQL Editor if you get 403 or permission errors when adding cigars.
-- Disables Row Level Security on cigar_catalog so server-side inserts work.

ALTER TABLE cigar_catalog DISABLE ROW LEVEL SECURITY;


-- Add an is_all_day flag to classes for always-accessible classes
ALTER TABLE public.classes ADD COLUMN is_all_day boolean NOT NULL DEFAULT false;

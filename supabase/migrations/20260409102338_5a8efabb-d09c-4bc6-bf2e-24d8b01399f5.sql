
ALTER TABLE public.projects ADD COLUMN pages jsonb DEFAULT NULL;
ALTER TABLE public.projects ADD COLUMN is_multipage boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS disable_export boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS read_only_funnel boolean NOT NULL DEFAULT false;
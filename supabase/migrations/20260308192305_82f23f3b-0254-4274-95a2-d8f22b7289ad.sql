
-- Add hide_phone flag to user_roles
ALTER TABLE public.user_roles ADD COLUMN hide_phone BOOLEAN NOT NULL DEFAULT false;

-- Add pipeline permissions
ALTER TABLE public.user_roles ADD COLUMN pipeline_access TEXT NOT NULL DEFAULT 'full';
-- 'full' = read+write, 'view' = read only, 'create' = can only create

-- Create webhook_keys table for API access
CREATE TABLE public.webhook_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  pipeline_id UUID REFERENCES public.pipelines(id),
  stage_id UUID REFERENCES public.pipeline_stages(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own webhook keys" ON public.webhook_keys FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all webhook keys" ON public.webhook_keys FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

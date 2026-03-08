
-- Table to store segment messaging history
CREATE TABLE public.segment_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id uuid REFERENCES public.dynamic_segments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  template_content text NOT NULL,
  total_contacts integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.segment_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own segment messages" ON public.segment_messages
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

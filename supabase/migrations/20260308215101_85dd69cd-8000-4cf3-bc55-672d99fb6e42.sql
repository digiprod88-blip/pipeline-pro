
-- Task comments table for internal team collaboration
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view task comments"
ON public.task_comments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert task comments"
ON public.task_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON public.task_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add invoice fields to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_date timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes text;

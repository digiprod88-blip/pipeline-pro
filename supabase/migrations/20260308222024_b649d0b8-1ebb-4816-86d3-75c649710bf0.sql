
CREATE TABLE public.manifestation_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_days INTEGER NOT NULL DEFAULT 30,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_days INTEGER[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.manifestation_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can manage own goals" ON public.manifestation_goals
  FOR ALL USING (
    contact_id = (SELECT profiles.client_contact_id FROM profiles WHERE profiles.user_id = auth.uid())
  )
  WITH CHECK (
    contact_id = (SELECT profiles.client_contact_id FROM profiles WHERE profiles.user_id = auth.uid())
  );

CREATE POLICY "Staff can view all goals" ON public.manifestation_goals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'staff'))
  );

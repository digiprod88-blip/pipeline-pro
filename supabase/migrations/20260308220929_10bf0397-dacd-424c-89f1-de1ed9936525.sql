
-- Ad spend tracking table for ROI dashboard
CREATE TABLE public.ad_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  platform text NOT NULL DEFAULT 'meta',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  campaign_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_spend ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ad spend" ON public.ad_spend FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Content library table for AI content lab
CREATE TABLE public.content_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  content_type text NOT NULL DEFAULT 'ad_copy',
  content jsonb NOT NULL DEFAULT '{}',
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own content" ON public.content_library FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Support tickets table for client portal
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can manage own tickets" ON public.support_tickets FOR ALL USING (
  contact_id = (SELECT profiles.client_contact_id FROM profiles WHERE profiles.user_id = auth.uid())
) WITH CHECK (
  contact_id = (SELECT profiles.client_contact_id FROM profiles WHERE profiles.user_id = auth.uid())
);
CREATE POLICY "Staff can view all tickets" ON public.support_tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'staff'))
);
CREATE POLICY "Staff can update tickets" ON public.support_tickets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'staff'))
);

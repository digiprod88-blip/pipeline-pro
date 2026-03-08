
-- 1. Referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  referred_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  referral_code text NOT NULL UNIQUE,
  referred_name text,
  referred_email text,
  status text NOT NULL DEFAULT 'pending',
  reward_credits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own referrals" ON public.referrals
  FOR SELECT USING (
    referrer_contact_id = (SELECT profiles.client_contact_id FROM profiles WHERE profiles.user_id = auth.uid())
  );

CREATE POLICY "Staff can view all referrals" ON public.referrals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'staff'))
  );

CREATE POLICY "System can insert referrals" ON public.referrals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can update referrals" ON public.referrals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'staff'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'staff'))
  );

-- 2. Client journals table
CREATE TABLE public.client_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  gratitudes text,
  intentions text,
  reflections text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients manage own journals" ON public.client_journals
  FOR ALL USING (
    contact_id = (SELECT profiles.client_contact_id FROM profiles WHERE profiles.user_id = auth.uid())
  ) WITH CHECK (
    contact_id = (SELECT profiles.client_contact_id FROM profiles WHERE profiles.user_id = auth.uid())
  );

CREATE POLICY "Staff can view journals" ON public.client_journals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'staff'))
  );

-- 3. Vision board images table  
CREATE TABLE public.vision_board_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vision_board_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients manage own vision board" ON public.vision_board_images
  FOR ALL USING (
    contact_id = (SELECT profiles.client_contact_id FROM profiles WHERE profiles.user_id = auth.uid())
  ) WITH CHECK (
    contact_id = (SELECT profiles.client_contact_id FROM profiles WHERE profiles.user_id = auth.uid())
  );

-- 4. Dynamic segments table
CREATE TABLE public.dynamic_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  auto_tag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dynamic_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own segments" ON public.dynamic_segments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Vision board storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('vision-board', 'vision-board', true);

CREATE POLICY "Authenticated upload vision board" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vision-board');

CREATE POLICY "Public read vision board" ON storage.objects
  FOR SELECT USING (bucket_id = 'vision-board');

CREATE POLICY "Users delete own vision board files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'vision-board' AND (storage.foldername(name))[1] = auth.uid()::text);

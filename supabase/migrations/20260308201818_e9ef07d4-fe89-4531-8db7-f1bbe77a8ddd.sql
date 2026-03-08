
-- Workflows table
CREATE TABLE public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT false,
  trigger_type text NOT NULL DEFAULT 'new_lead',
  trigger_config jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Workflow actions table
CREATE TABLE public.workflow_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  action_type text NOT NULL DEFAULT 'send_message',
  action_config jsonb DEFAULT '{}',
  delay_minutes integer DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Workflow logs table
CREATE TABLE public.workflow_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'success',
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Appointments table
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Available slots for booking
CREATE TABLE public.booking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day_of_week integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

-- Call logs table
CREATE TABLE public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'outbound',
  duration_seconds integer DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  recording_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  product_type text NOT NULL DEFAULT 'digital',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  payment_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Workflows policies
CREATE POLICY "Users manage own workflows" ON public.workflows FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own workflows" ON public.workflows FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users manage own workflow actions" ON public.workflow_actions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_id AND w.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_id AND w.user_id = auth.uid())
);

CREATE POLICY "Users view workflow logs" ON public.workflow_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_id AND w.user_id = auth.uid())
);
CREATE POLICY "System can insert workflow logs" ON public.workflow_logs FOR INSERT WITH CHECK (true);

-- Appointments policies
CREATE POLICY "Users manage own appointments" ON public.appointments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated view appointments" ON public.appointments FOR SELECT USING (true);

-- Booking slots policies
CREATE POLICY "Users manage own slots" ON public.booking_slots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view active slots" ON public.booking_slots FOR SELECT USING (is_active = true);

-- Call logs policies
CREATE POLICY "Users manage own call logs" ON public.call_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated view call logs" ON public.call_logs FOR SELECT USING (true);

-- Products policies
CREATE POLICY "Users manage own products" ON public.products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (is_active = true);

-- Orders policies
CREATE POLICY "Users manage own orders" ON public.orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated view orders" ON public.orders FOR SELECT USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Add 'client' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- Add client_contact_id to profiles to link client users to their contact
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Add visible_to_client to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS visible_to_client boolean NOT NULL DEFAULT false;

-- RLS: clients can view their own linked contact
CREATE POLICY "Clients can view own contact"
ON public.contacts FOR SELECT
TO authenticated
USING (
  id = (SELECT client_contact_id FROM public.profiles WHERE user_id = auth.uid())
);

-- RLS: clients can view tasks visible to them
CREATE POLICY "Clients can view visible tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (
  visible_to_client = true
  AND contact_id = (SELECT client_contact_id FROM public.profiles WHERE user_id = auth.uid())
);

-- RLS: clients can view their own orders
CREATE POLICY "Clients can view own orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  contact_id = (SELECT client_contact_id FROM public.profiles WHERE user_id = auth.uid())
);

-- RLS: clients can view messages for their contact
CREATE POLICY "Clients can view own messages"
ON public.messages FOR SELECT
TO authenticated
USING (
  contact_id = (SELECT client_contact_id FROM public.profiles WHERE user_id = auth.uid())
);

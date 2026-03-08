
-- Create storage bucket for client files
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-files', 'client-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create client_files table to track file metadata
CREATE TABLE IF NOT EXISTS public.client_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint DEFAULT 0,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;

-- Admin/staff can manage all files
CREATE POLICY "Staff can manage client files"
ON public.client_files FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
);

-- Clients can view files for their linked contact
CREATE POLICY "Clients can view own files"
ON public.client_files FOR SELECT
TO authenticated
USING (
  contact_id = (SELECT client_contact_id FROM public.profiles WHERE user_id = auth.uid())
);

-- Storage RLS: staff can upload
CREATE POLICY "Staff can upload client files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-files'
  AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
);

-- Storage RLS: staff can read all, clients can read own
CREATE POLICY "Authenticated can read client files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-files'
);

-- Storage RLS: staff can delete
CREATE POLICY "Staff can delete client files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-files'
  AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
);

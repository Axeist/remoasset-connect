-- Add attachments to lead_activities (URLs and file references)
ALTER TABLE public.lead_activities
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';

-- Storage bucket for activity files (screenshots, images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'activity-files',
  'activity-files',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to activity-files
CREATE POLICY "Authenticated can upload activity files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'activity-files');

-- Allow public read for activity-files (public bucket)
CREATE POLICY "Public read activity files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'activity-files');

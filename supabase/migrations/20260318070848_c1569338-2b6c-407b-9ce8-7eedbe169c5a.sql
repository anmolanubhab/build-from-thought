
-- Create storage bucket for deployed sites
INSERT INTO storage.buckets (id, name, public) VALUES ('deployed-sites', 'deployed-sites', true);

-- Allow authenticated users to upload to deployed-sites
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'deployed-sites');
CREATE POLICY "Authenticated users can update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'deployed-sites');
CREATE POLICY "Public can read deployed sites" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'deployed-sites');
CREATE POLICY "Authenticated can read deployed sites" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'deployed-sites');

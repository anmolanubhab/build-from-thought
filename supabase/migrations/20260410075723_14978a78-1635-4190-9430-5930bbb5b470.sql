
-- Project Versions table
CREATE TABLE public.project_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code TEXT,
  version_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions of own projects"
  ON public.project_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "Users can insert versions for own projects"
  ON public.project_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "Users can delete versions of own projects"
  ON public.project_versions FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid())
  );

-- AI Generations table
CREATE TABLE public.ai_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  response TEXT,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai generations"
  ON public.ai_generations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai generations"
  ON public.ai_generations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Deployments table
CREATE TABLE public.deployments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  deploy_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deployments of own projects"
  ON public.deployments FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = deployments.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "Users can insert deployments for own projects"
  ON public.deployments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = deployments.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "Users can update deployments of own projects"
  ON public.deployments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = deployments.project_id AND projects.user_id = auth.uid())
  );

-- Shared Projects table
CREATE TABLE public.shared_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shared projects"
  ON public.shared_projects FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert shares for own projects"
  ON public.shared_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = shared_projects.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "Users can delete shares for own projects"
  ON public.shared_projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = shared_projects.project_id AND projects.user_id = auth.uid())
  );

-- Auto-increment version number function
CREATE OR REPLACE FUNCTION public.set_version_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO NEW.version_number
  FROM public.project_versions
  WHERE project_id = NEW.project_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_version_number_trigger
  BEFORE INSERT ON public.project_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_version_number();

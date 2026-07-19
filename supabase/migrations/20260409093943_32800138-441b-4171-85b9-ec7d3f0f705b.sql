
CREATE TABLE public.github_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  github_username TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.github_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own github token"
  ON public.github_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own github token"
  ON public.github_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own github token"
  ON public.github_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own github token"
  ON public.github_tokens FOR DELETE
  USING (auth.uid() = user_id);

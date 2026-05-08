-- Scanner usage logs — tracks per-user monthly scan counts for plan enforcement
CREATE TABLE IF NOT EXISTS public.scanner_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scan_month  char(7)     NOT NULL, -- 'YYYY-MM'
  document_type text,
  file_name   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scanner_logs_user_month ON public.scanner_logs (user_id, scan_month);

ALTER TABLE public.scanner_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scanner logs"
  ON public.scanner_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scanner logs"
  ON public.scanner_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

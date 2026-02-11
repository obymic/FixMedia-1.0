
-- Stats table for tracking repairs and visits (anonymous, no auth needed)
CREATE TABLE public.app_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_type TEXT NOT NULL, -- 'visit' or 'repair'
  file_type TEXT, -- 'image' or 'video' (null for visits)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_stats ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (tracking events)
CREATE POLICY "Anyone can insert stats"
ON public.app_stats
FOR INSERT
TO anon, authenticated
WITH CHECK (stat_type IN ('visit', 'repair'));

-- Allow anyone to read stats (for displaying counters)
CREATE POLICY "Anyone can read stats"
ON public.app_stats
FOR SELECT
TO anon, authenticated
USING (true);

-- Index for fast aggregation queries
CREATE INDEX idx_app_stats_type ON public.app_stats(stat_type);
CREATE INDEX idx_app_stats_created ON public.app_stats(created_at);

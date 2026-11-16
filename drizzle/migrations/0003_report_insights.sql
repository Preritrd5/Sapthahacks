-- Migration 0003: Dedicated Permanent Report Insights Persistence
-- Stores evidence-based AI insights (Key Strengths, Areas to Improve, Suggestions)
-- with atomic upsert, RLS enforcement, and evaluation version tracking.

CREATE TABLE IF NOT EXISTS public.report_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  areas_to_improve jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'generated', -- 'generated', 'pending', 'failed', 'unavailable'
  failure_reason text,
  model text DEFAULT 'google/gemini-3.1-flash-lite',
  evaluation_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_insights_team_id_key UNIQUE (team_id)
);

CREATE INDEX IF NOT EXISTS report_insights_team_id_idx ON public.report_insights(team_id);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_insights TO authenticated;
GRANT ALL ON public.report_insights TO service_role;

-- Row Level Security
ALTER TABLE public.report_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all report_insights" ON public.report_insights;
CREATE POLICY "admin all report_insights" ON public.report_insights
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "service_role report_insights" ON public.report_insights;
CREATE POLICY "service_role report_insights" ON public.report_insights
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- 1) Add `pattern` field to problems (independent of topics)
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS pattern text;
CREATE INDEX IF NOT EXISTS problems_pattern_idx ON public.problems (user_id, pattern);

-- 2) Extend problem_status enum with new lifecycle states used by the revision priority engine.
--    Existing values (solved, need_revision, mastered, forgotten) are preserved.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'learning' AND enumtypid = 'public.problem_status'::regtype) THEN
    ALTER TYPE public.problem_status ADD VALUE 'learning';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'practicing' AND enumtypid = 'public.problem_status'::regtype) THEN
    ALTER TYPE public.problem_status ADD VALUE 'practicing';
  END IF;
END $$;

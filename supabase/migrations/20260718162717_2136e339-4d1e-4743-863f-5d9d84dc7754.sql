
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 1;

UPDATE public.problems
SET review_count = GREATEST(COALESCE(times_solved, 1), COALESCE(revision_count, 0) + 1, 1);

ALTER TABLE public.problems DROP COLUMN IF EXISTS times_solved;
ALTER TABLE public.problems DROP COLUMN IF EXISTS revision_count;
ALTER TABLE public.problems DROP COLUMN IF EXISTS next_revision_date;
ALTER TABLE public.problems DROP COLUMN IF EXISTS interval_index;

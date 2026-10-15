ALTER TABLE public.problems DROP COLUMN IF EXISTS confidence;
ALTER TABLE public.revisions DROP COLUMN IF EXISTS confidence_before;
ALTER TABLE public.revisions DROP COLUMN IF EXISTS confidence_after;
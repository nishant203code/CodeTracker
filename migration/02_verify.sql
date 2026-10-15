-- ============================================================
-- CodeTracker — Database Verification Script
-- Run this in your new Supabase project's SQL Editor to verify schema
-- ============================================================

-- 1. Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Check RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- 3. Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Check row counts for all tables
SELECT 'profiles' AS table_name, count(*) AS count FROM public.profiles
UNION ALL
SELECT 'problems', count(*) FROM public.problems
UNION ALL
SELECT 'revisions', count(*) FROM public.revisions
UNION ALL
SELECT 'revision_sessions', count(*) FROM public.revision_sessions
UNION ALL
SELECT 'revision_session_items', count(*) FROM public.revision_session_items
UNION ALL
SELECT 'app_user_connections', count(*) FROM public.app_user_connections
UNION ALL
SELECT 'extension_tokens', count(*) FROM public.extension_tokens
UNION ALL
SELECT 'github_settings', count(*) FROM public.github_settings;

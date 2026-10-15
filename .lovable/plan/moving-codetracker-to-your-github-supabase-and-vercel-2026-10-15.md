# Moving CodeTracker to your GitHub, Supabase and Vercel

Goal: the code lives in a public GitHub repo under your name, the app runs on Vercel, and all data sits in your own Supabase project. The current Lovable site keeps working until the new one passes every check.

## Phase 1 — Code on your GitHub (you, ~10 min)
1. In Lovable: Plus (+) menu → GitHub → Connect project. Authorize the Lovable GitHub App for your account `nishant203code`.
2. Lovable can't push into an existing repo, so either delete the empty `CodeTracker` repo first or let Lovable create a new one (e.g. `CodeTracker`).
3. Lovable pushes the full code. Every later change syncs on its own.
4. On GitHub: Settings → set the repo to Public. Add a description and a README with your name, screenshots and a feature list (I'll write the README).
5. Commits are made by Lovable's bot. If you want the history to show only you: clone the repo, then run `git checkout --orphan main-clean && git add -A && git commit -m "CodeTracker by Nishant" --author="Your Name <your@email>"`, and force-push. That leaves a single commit under your name.
6. Check: `.env` is not in the repo (it's already excluded). The keys you pasted in chat were never put in code.

## Phase 2 — Make the code independent of Lovable (me)
- README: project description, your name, setup steps.
- Google sign-in: swap the Lovable helper for normal sign-in through your Supabase project.
- GitHub push: swap the Lovable connector for your own GitHub OAuth app (direct calls to api.github.com, token stored encrypted).
- Hosting: change the build target from Cloudflare to Vercel.
- Remove Lovable-only files (error reporting, preview auth helpers, the `lovable` integration folder).
- Extension: change the site address to your Vercel domain and re-zip it.
- Keep these changes on a separate branch so the live Lovable site isn't affected.

## Phase 3 — Your Supabase database (you + me)
1. Rotate the service role key (Supabase → Settings → API), because it was shared in chat.
2. Run `migration/01_schema.sql` in your Supabase SQL editor (tables + per-user privacy rules).
3. Export data: Lovable Cloud → Advanced settings → Export data (CSV per table).
4. Run `migration/02_copy_data.sh` to import the data into your project.
5. Accounts: if user passwords can't be exported, users sign in with Google or reset their password; their data stays linked by email.
6. Run `migration/03_verify.sql` on both databases: counts must match and the privacy checks must return nothing.
7. Supabase Auth: turn on Google (your own Google OAuth client), and set the Site URL and redirect URLs to your Vercel domain.

## Phase 4 — Deploy on Vercel (you, ~15 min)
1. vercel.com → Import Project → pick your GitHub repo.
2. Add these environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `APP_USER_CONNECTION_KEY_SECRET`.
3. Create a new GitHub OAuth app with the callback `https://<your-vercel-domain>/api/oauth/github/return`.
4. Deploy. Add a custom domain later if you want one.

## Phase 5 — Test and switch over
- Work through the checklist in `migration/README.md`: sign-in, adding a problem, the duplicate rule, revise and history, dashboard, analytics, GitHub connect, extension save and push, the phone app, and a second test user who sees no data but their own.
- Re-download the extension from the new site and generate a new key.
- Only after every item passes: stop using the Lovable site.

## What I need from you
- Confirm Phase 1 is done (repo link).
- Your name and email for the README and commits.
- The Vercel domain once it's created.
- A Google OAuth client ID and a GitHub OAuth app client ID. Put the secrets in Vercel, not in chat.

## Technical notes
- The Vercel build uses the TanStack Start Vercel/Node preset in `vite.config.ts`. Server routes (`/api/public/extension/save`) keep working there.
- `src/integrations/supabase/*` files stay but read your env vars. The Lovable preview storage helper is replaced with the default storage.
- Phase 2 edits would break the Lovable preview, so they go on a `vercel` branch that you deploy from Vercel. `main` stays as the live Lovable version until cutover.

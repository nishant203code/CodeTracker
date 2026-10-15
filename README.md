# CodeTracker

Built by **Nishant** ([@nishant203code](https://github.com/nishant203code)).

CodeTracker is a tracker for competitive programmers. You log the problems you solve, then revise them with spaced repetition.

## Features

- **Problem log** — save problems from LeetCode and other platforms; paste a LeetCode link to auto-fill the details.
- **Duplicate detection** — solving a problem again raises its "Times solved" count instead of adding a second entry.
- **Spaced-repetition revisions** — Smart and topic-wise revision sessions, with a saved history you can reopen as cards.
- **Dashboard** — year-long activity heatmap, solving and revision streaks, and today's solved / revised counts.
- **Analytics** — status mix, best practice days, weak topics, and problems going stale.
- **Chrome extension** — saves Accepted LeetCode solutions automatically and pushes the code to your GitHub repo.
- **Mobile app (PWA)** — installs on your phone's home screen and runs full-screen.

## Tech stack

TanStack Start (React 19, Vite), Tailwind CSS v4, Supabase (Postgres, Auth, row-level security).

## Running locally

```bash
bun install
```

Create a `.env` file in the project root with your Supabase credentials:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_SUPABASE_PROJECT_ID=your-project-id
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-side only
```

Then start the dev server:

```bash
bun run dev
```

## Chrome extension

The extension lives in [`extension/`](extension/). Load it via `chrome://extensions` → Developer mode → **Load unpacked**, then connect it from the app's Settings page (generate an extension key and paste it into the extension popup).

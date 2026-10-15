# LeetCode → CodeTracker → GitHub Chrome Extension

## What you get

When LeetCode marks your submission **Accepted**, a small CodeTracker panel opens on the LeetCode page. It shows:

- Problem name, number, link, difficulty and topics, all filled in automatically
- Your accepted code and its language
- Time taken from the auto timer, which you can change before saving
- Optional notes or hints
- A "Push to GitHub" checkbox, on by default once GitHub is connected

You click **Save**. Then:

1. The problem is saved in CodeTracker, or "Times solved" goes up by one if it's already there. This uses the same duplicate rule as today.
2. The code goes to your GitHub repo as `0001-two-sum/solution.cpp` plus a `README.md` with the link, difficulty, topics, date and time taken.
3. The GitHub file link is put into the problem's **Solution link**.

## Setup (one time)

1. In CodeTracker, a new **Settings → Integrations** page has:
   - **Connect GitHub**: sign in with GitHub and choose or create a repo (default name `leetcode-solutions`).
   - **Extension**: a download button, install steps, and a **Generate extension key** button.
2. Install the extension in Chrome with "Load unpacked". Open its popup and paste the key. This links the extension to your CodeTracker account.

## Timer

- It starts when you first open a problem page and pauses when the tab isn't visible.
- It's saved per problem, so it survives a page refresh.
- It stops on Accepted. Its minutes fill "Time taken", which you can edit.
- The popup also lets you reset the timer.

## Out of scope for now

- Platforms other than LeetCode (Codeforces could come later)
- Saving failed submissions
- Publishing to the Chrome Web Store (you install it manually)

## Technical details

- **Extension (Manifest V3)** in `extension/`:
  - A content script on `leetcode.com/problems/*` runs the timer and detects Accepted by watching LeetCode's `/submissions/detail/{id}/check/` responses.
  - It reads code, language, problem number and slug from LeetCode GraphQL (`submissionDetails` and `question`), using your LeetCode session already in the browser.
  - The panel is injected into the page; the background service worker holds the extension key in `chrome.storage.local`.
  - The package is zipped to `public/codetracker-extension.zip`.
- **Linking the extension:** a new `extension_tokens` table stores a hashed token per user, shown once when generated and revocable. The extension calls `POST /api/public/extension/save` with a Bearer token. The handler hashes and checks the token, resolves the user, then runs the existing dedup save logic server-side with the admin client, scoped to that user.
- **GitHub:** use the App User Connector for GitHub (per-user OAuth, `repo` scope). The encrypted connection key lives in `app_user_connections`, and the chosen repo goes in a new `github_settings` table (user_id, repo owner/name). The server uses the GitHub contents API to create or update `solution.<ext>` and `README.md`, then returns the `html_url`, which is written to `solution_link`.
- **CORS:** the API route allows the extension origin. All private data access is checked by token in the handler.
- **Problem form:** no changes. Solution link and Time taken already exist.

## Needs from you

- A GitHub OAuth app registered once in workspace connector settings, with callback `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback`. I'll show a setup card with step-by-step help.

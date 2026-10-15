# CodeTracker Guidelines

- Chrome extension source lives in `extension/` and is zipped to `public/codetracker-extension.zip` (re-zip after edits); it talks only to `/api/public/extension/save` with a hashed per-user `ct_` token — why: keeps the extension isolated so its failures can't affect app pages.
- GitHub integration uses encrypted access tokens in `app_user_connections` (server-only); GitHub push failures never roll back the problem save — why: saving progress matters more than the backup.

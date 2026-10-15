import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/oauth/github/return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        // GitHub redirects back with ?code=...&state=... on success,
        // or ?error=...&error_description=...&state=... on failure.
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const errorDesc = url.searchParams.get("error_description");

        const result = code
          ? { success: true, connectorId: "github", code }
          : {
              success: false,
              connectorId: "github",
              error: errorDesc || error || "OAuth failed",
            };

        const esc = (s: string) =>
          s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
        const safeJson = JSON.stringify(result).replace(/<\//g, "<\\/");
        const statusMsg = result.success
          ? "Connection complete, closing…"
          : "Failed: " + esc((result as { error?: string }).error ?? "Unknown error");
        const html = `<!DOCTYPE html><html><head><title>Finishing connection…</title></head><body>
<p>${statusMsg}</p>
<script>
const result = ${safeJson};
const type = result.success ? "appUserConnectorOAuthComplete" : "appUserConnectorOAuthFailed";
if (window.opener && window.opener !== window) {
  window.opener.postMessage({ type, connectorId: result.connectorId, code: result.code ?? null }, window.location.origin);
}
// Small delay so the parent window reliably processes the message before we close
setTimeout(function() { window.close(); }, 300);
</script></body></html>`;
        return new Response(html, { headers: { "Content-Type": "text/html" } });
      },
    },
  },
});

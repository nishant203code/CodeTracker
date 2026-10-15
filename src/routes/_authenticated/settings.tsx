import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Github, Puzzle, Download, KeyRound, Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getIntegrationStatus,
  startGithubConnect,
  completeGithubConnect,
  saveGithubRepo,
  disconnectGithub,
  generateExtensionToken,
  revokeExtensionToken,
} from "@/lib/integrations.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · CodeTracker" },
      { name: "description", content: "Connect GitHub and the CodeTracker LeetCode extension." },
      { property: "og:title", content: "Settings · CodeTracker" },
      {
        property: "og:description",
        content: "Connect GitHub and the CodeTracker LeetCode extension.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

function waitForOAuth(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    let received = false;
    const cleanup = () => {
      window.removeEventListener("message", onMsg);
      window.clearInterval(poll);
    };
    const onMsg = (e: MessageEvent) => {
      const t = e.data?.type;
      if (
        e.origin !== window.location.origin ||
        e.source !== popup ||
        e.data?.connectorId !== "github" ||
        (t !== "appUserConnectorOAuthComplete" && t !== "appUserConnectorOAuthFailed")
      )
        return;
      received = true;
      cleanup();
      if (t === "appUserConnectorOAuthComplete")
        resolve(typeof e.data.code === "string" ? e.data.code : null);
      else {
        popup.close();
        reject(new Error("GitHub connection failed."));
      }
    };
    window.addEventListener("message", onMsg);
    const poll = window.setInterval(() => {
      if (!popup.closed) return;
      // Only reject if we haven't already received the postMessage
      if (received) return;
      cleanup();
      reject(new Error("The GitHub window was closed before finishing."));
    }, 500);
  });
}

function Settings() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getIntegrationStatus);
  const startFn = useServerFn(startGithubConnect);
  const completeFn = useServerFn(completeGithubConnect);
  const repoFn = useServerFn(saveGithubRepo);
  const discFn = useServerFn(disconnectGithub);
  const genFn = useServerFn(generateExtensionToken);
  const revokeFn = useServerFn(revokeExtensionToken);

  const { data: s, isLoading } = useQuery(
    queryOptions({
      queryKey: ["integrations"],
      queryFn: () => statusFn(),
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.token && !data.token.last_used_at) return 3000;
        return false;
      },
    }),
  );
  const [repo, setRepo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (s?.repoOwner && s?.repoName) setRepo(`https://github.com/${s.repoOwner}/${s.repoName}`);
  }, [s?.repoOwner, s?.repoName]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["integrations"] });

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function connect() {
    await run("connect", async () => {
      // Get the authorization URL first, before opening the popup,
      // so the user never sees a blank window.
      const { authorizationUrl } = await startFn();

      const popup = window.open(authorizationUrl, "ct-github-oauth", "width=600,height=720");
      if (!popup) {
        toast.error("Popup blocked. Allow popups and try again.");
        return;
      }

      let code: string | null;
      try {
        code = await waitForOAuth(popup);
      } catch (e) {
        popup.close();
        throw e;
      }
      if (code) await completeFn({ data: { code } });
      await refresh();
      toast.success(s?.githubConnected ? "Reconnected to GitHub" : "GitHub connected");
    });
  }

  function download() {
    fetch("/codetracker-extension.zip")
      .then((r) => {
        if (!r.ok) throw new Error(`Download failed (${r.status})`);
        return r.blob();
      })
      .then((b) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = "codetracker-extension.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((e) => toast.error(e.message));
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Auto-track LeetCode solutions and back them up to GitHub.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">GitHub</h2>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !s?.githubConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect GitHub so every accepted LeetCode solution is saved to a repo, and its link is
              added to the problem.
            </p>
            <Button onClick={connect} disabled={busy !== null}>
              {busy === "connect" ? "Connecting…" : "Connect GitHub"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              Connected
              {s.githubLogin ? (
                <>
                  {" "}
                  as <span className="font-medium text-primary">@{s.githubLogin}</span>
                </>
              ) : null}
              .
              {s.repoOwner && s.repoName ? (
                <>
                  {" "}
                  Solutions go to{" "}
                  <span className="font-mono text-xs">
                    {s.repoOwner}/{s.repoName}
                  </span>
                  .
                </>
              ) : null}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">
                  Your existing repository link
                </label>
                <Input
                  value={repo}
                  placeholder="https://github.com/you/your-solutions"
                  onChange={(e) => setRepo(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() =>
                  run("repo", async () => {
                    const r = await repoFn({ data: { repo } });
                    await refresh();
                    toast.success(`New solutions will sync to ${r.owner}/${r.repo}`);
                  })
                }
              >
                {busy === "repo" ? "Saving…" : "Save repo"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={connect} disabled={busy !== null}>
                Reconnect
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  run("disc", async () => {
                    await discFn();
                    await refresh();
                    toast.success("GitHub disconnected");
                  })
                }
              >
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">LeetCode Chrome extension</h2>
          </div>
          {isLoading ? (
            <Badge variant="outline" className="text-muted-foreground text-xs">
              Loading…
            </Badge>
          ) : s?.token ? (
            s.token.last_used_at ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 font-medium text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5" />
                Connected
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 font-medium text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mr-1.5" />
                Key generated · not connected yet
              </Badge>
            )
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-xs">
              Not configured
            </Badge>
          )}
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Download the extension and unzip it.</li>
          <li>
            Open <span className="font-mono text-xs">chrome://extensions</span> and turn on{" "}
            <b>Developer mode</b> (top right).
          </li>
          <li>
            Click <b>Load unpacked</b> and pick the unzipped folder.
          </li>
          <li>Generate a key below, click the extension icon and paste it in.</li>
          <li>Solve a problem on LeetCode — when it's Accepted, a CodeTracker panel pops up.</li>
        </ol>
        <Button variant="secondary" onClick={download}>
          <Download className="mr-2 h-4 w-4" /> Download extension
        </Button>

        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4" /> Extension key
            </div>
            {s?.token && (
              <span className="text-xs text-muted-foreground font-mono">
                Key ending in …{s.token.token_hint}
              </span>
            )}
          </div>
          {newToken ? (
            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">
                Copy it now and paste it into the extension popup — it won't be shown again in full.
              </p>
              <div className="flex gap-2">
                <Input readOnly value={newToken} className="font-mono text-xs" />
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Copy key"
                  onClick={() => {
                    navigator.clipboard.writeText(newToken);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                {s?.token?.last_used_at
                  ? `✓ Connected · last validated ${new Date(s.token.last_used_at).toLocaleTimeString()}`
                  : "Waiting for extension to connect and validate this key…"}
              </p>
            </div>
          ) : s?.token ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Active key ending in <span className="font-mono font-medium text-foreground">…{s.token.token_hint}</span>
                {s.token.last_used_at ? (
                  <>
                    {" · "}
                    <span className="text-emerald-400 font-medium">Connected</span>
                    {` (last used ${new Date(s.token.last_used_at).toLocaleString()})`}
                  </>
                ) : (
                  <>
                    {" · "}
                    <span className="text-amber-400 font-medium">Pending connection</span>
                    {" (enter key in extension and click Save & test connection)"}
                  </>
                )}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No key generated yet.</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                run("gen", async () => {
                  const { token } = await genFn();
                  setNewToken(token);
                  await refresh();
                })
              }
            >
              {s?.token ? "Generate new key" : "Generate key"}
            </Button>
            {s?.token && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() =>
                  run("revoke", async () => {
                    await revokeFn();
                    setNewToken(null);
                    await refresh();
                    toast.success("Extension disconnected");
                  })
                }
              >
                Disconnect extension
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

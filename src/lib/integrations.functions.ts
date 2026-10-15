import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: conn }, { data: gs }, { data: tok }] = await Promise.all([
      supabaseAdmin
        .from("app_user_connections")
        .select("id")
        .eq("user_id", context.userId)
        .eq("connector_id", "github")
        .maybeSingle(),
      supabaseAdmin.from("github_settings").select("*").eq("user_id", context.userId).maybeSingle(),
      supabaseAdmin
        .from("extension_tokens")
        .select("token_hint,created_at,last_used_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    return {
      githubConnected: !!conn,
      githubLogin: gs?.github_login ?? null,
      repoOwner: gs?.repo_owner ?? null,
      repoName: gs?.repo_name ?? null,
      token: tok ?? null,
    };
  });

export const startGithubConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientKey = process.env["GITHUB_APP_USER_CONNECTOR_CLIENT_API_KEY"];
    if (!clientKey) throw new Error("GitHub connection is not configured yet.");
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const { GATEWAY_BASE_URL, GITHUB_SCOPES } = await import("@/server/github.server");
    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/api/oauth/github/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();
    const existing = await getConnectionKeyForUser(context.userId, "github");
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: "github",
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: { scopes: GITHUB_SCOPES },
    });
    return { authorizationUrl };
  });

export const completeGithubConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    if (typeof input?.code !== "string" || !input.code) throw new Error("code required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const { GATEWAY_BASE_URL, getGithubLogin } = await import("@/server/github.server");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== "github") throw new Error("OAuth completion returned the wrong connector");
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    let login: string | null = null;
    try {
      login = await getGithubLogin(context.userId);
    } catch (e) {
      console.error(e);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: gs } = await supabaseAdmin
      .from("github_settings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    await supabaseAdmin.from("github_settings").upsert({
      user_id: context.userId,
      github_login: login,
      repo_owner: gs?.repo_owner ?? null,
      repo_name: gs?.repo_name ?? null,
      updated_at: new Date().toISOString(),
    });
    return { ok: true, login };
  });

export const saveGithubRepo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { repo: string }) => {
    const raw = String(input?.repo ?? "")
      .trim()
      .replace(/\.git$/, "")
      .replace(/\/+$/, "");
    const m = raw.match(
      /^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([A-Za-z0-9-]{1,39})\/([A-Za-z0-9_.-]{1,100})$/,
    );
    if (!m) throw new Error("Paste a GitHub repo link like https://github.com/you/repo");
    return { owner: m[1], repo: m[2] };
  })
  .handler(async ({ data, context }) => {
    const { getGithubLogin, checkRepoWritable } = await import("@/server/github.server");
    const login = await getGithubLogin(context.userId);
    const full = await checkRepoWritable(context.userId, data.owner, data.repo);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("github_settings").upsert({
      user_id: context.userId,
      github_login: login,
      repo_owner: full.owner,
      repo_name: full.repo,
      updated_at: new Date().toISOString(),
    });
    return full;
  });

export const disconnectGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
    const { getConnectionKeyForUser, deleteConnectionKeyForUser } =
      await import("@/server/appUserConnections.server");
    const { GATEWAY_BASE_URL } = await import("@/server/github.server");
    const key = await getConnectionKeyForUser(context.userId, "github");
    if (key) {
      try {
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: "github",
        });
      } catch (e) {
        console.error(e);
      }
    }
    await deleteConnectionKeyForUser(context.userId, "github");
    return { ok: true };
  });

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const generateExtensionToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token =
      "ct_" +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("extension_tokens").upsert(
      {
        user_id: context.userId,
        token_hash: await sha256Hex(token),
        token_hint: token.slice(-4),
        created_at: new Date().toISOString(),
        last_used_at: null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { token };
  });

export const revokeExtensionToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("extension_tokens").delete().eq("user_id", context.userId);
    return { ok: true };
  });

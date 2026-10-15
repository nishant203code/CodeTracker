// Server-only GitHub helpers (called from server fns / server routes).
import { getConnectionKeyForUser } from "@/server/appUserConnections.server";

export const GITHUB_SCOPES = ["read:user", "repo"];

export class GithubError extends Error {
  constructor(
    message: string,
    public reconnect = false,
  ) {
    super(message);
  }
}

export async function gh(userId: string, path: string, init?: RequestInit) {
  const token = await getConnectionKeyForUser(userId, "github");
  if (!token) throw new GithubError("GitHub is not connected");
  const url = path.startsWith("http")
    ? path
    : `https://api.github.com${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "CodeTracker-App",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    throw new GithubError("GitHub access token expired or revoked. Reconnect it in Settings.", true);
  }
  return res;
}

async function ghJson<T>(userId: string, path: string, init?: RequestInit): Promise<T> {
  const res = await gh(userId, path, init);
  const text = await res.text();
  if (!res.ok) {
    console.error(`GitHub ${path} failed [${res.status}]: ${text}`);
    let msg = text;
    try {
      msg = JSON.parse(text).message ?? text;
    } catch {
      /* ignore */
    }
    throw new GithubError(`GitHub error (${res.status}): ${msg}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function getGithubLogin(userId: string) {
  const u = await ghJson<{ login: string }>(userId, "/user");
  return u.login;
}

// Uses an existing repo only — never creates one.
export async function checkRepoWritable(userId: string, owner: string, name: string) {
  const res = await gh(userId, `/repos/${owner}/${name}`);
  if (res.status === 404)
    throw new GithubError(`Repo ${owner}/${name} not found, or your GitHub account can't see it.`);
  if (!res.ok) throw new GithubError(`Could not check repo (${res.status}): ${await res.text()}`);
  const r = (await res.json()) as {
    name: string;
    owner: { login: string };
    permissions?: { push?: boolean };
  };
  if (r.permissions && !r.permissions.push)
    throw new GithubError(`Your GitHub account can't write to ${owner}/${name}.`);
  return { owner: r.owner.login, repo: r.name };
}

const EXT: Record<string, string> = {
  cpp: "cpp",
  c: "c",
  java: "java",
  python: "py",
  python3: "py",
  csharp: "cs",
  javascript: "js",
  typescript: "ts",
  php: "php",
  swift: "swift",
  kotlin: "kt",
  dart: "dart",
  golang: "go",
  go: "go",
  ruby: "rb",
  scala: "scala",
  rust: "rs",
  racket: "rkt",
  erlang: "erl",
  elixir: "ex",
  mysql: "sql",
  mssql: "sql",
  oraclesql: "sql",
  postgresql: "sql",
  pythondata: "py",
  bash: "sh",
};

function b64(s: string) {
  return Buffer.from(s, "utf8").toString("base64");
}

async function putFile(
  userId: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
) {
  const enc = path.split("/").map(encodeURIComponent).join("/");
  const existing = await gh(userId, `/repos/${owner}/${repo}/contents/${enc}`);
  let sha: string | undefined;
  if (existing.ok) sha = ((await existing.json()) as { sha?: string }).sha;
  const out = await ghJson<{ content: { html_url: string } }>(
    userId,
    `/repos/${owner}/${repo}/contents/${enc}`,
    { method: "PUT", body: JSON.stringify({ message, content: b64(content), sha }) },
  );
  return out.content.html_url;
}

export async function pushSolution(
  userId: string,
  repo: { owner: string; name: string },
  p: {
    problemId: string;
    slug: string;
    title: string;
    difficulty: string;
    topics: string[];
    lang: string;
    code: string;
    link: string;
    minutes: number | null;
    date: string;
  },
) {
  const num = /^\d+$/.test(p.problemId) ? p.problemId.padStart(4, "0") : p.problemId || "x";
  const folder = `${num}-${p.slug}`;
  const ext = EXT[p.lang.toLowerCase()] ?? "txt";
  const msg = `${p.problemId}. ${p.title} (${p.lang})`;
  const url = await putFile(
    userId,
    repo.owner,
    repo.name,
    `${folder}/solution.${ext}`,
    p.code,
    msg,
  );
  const readme = [
    `# ${p.problemId}. ${p.title}`,
    "",
    `- **Link:** ${p.link}`,
    `- **Difficulty:** ${p.difficulty[0].toUpperCase()}${p.difficulty.slice(1)}`,
    `- **Topics:** ${p.topics.join(", ") || "—"}`,
    `- **Language:** ${p.lang}`,
    "",
  ].join("\n");
  await putFile(userId, repo.owner, repo.name, `${folder}/README.md`, readme, `README: ${p.title}`);
  return url;
}

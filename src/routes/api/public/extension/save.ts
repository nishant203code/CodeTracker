import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const Body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
  title: z.string().min(1).max(300),
  problem_id: z.string().max(20).optional().default(""),
  difficulty: z.enum(["easy", "medium", "hard"]),
  topics: z.array(z.string().max(80)).max(30).default([]),
  lang: z.string().max(40).default(""),
  code: z.string().max(200_000).default(""),
  time_taken_minutes: z.number().int().min(0).max(10_000).nullable().optional(),
  notes: z.string().max(10_000).optional().default(""),
  hints: z.string().max(10_000).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  push_github: z.boolean().default(true),
  status: z.enum(["need_revision", "solved", "mastered", "forgotten"]).optional(),
});

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function authUser(request: Request) {
  const m = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(ct_[a-f0-9]{48})$/);
  if (!m) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("extension_tokens")
    .select("user_id")
    .eq("token_hash", await sha256Hex(m[1]))
    .maybeSingle();
  if (!data) return null;
  await supabaseAdmin
    .from("extension_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", data.user_id);
  return { userId: data.user_id as string, admin: supabaseAdmin };
}

export const Route = createFileRoute("/api/public/extension/save")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      // Connection check used by the extension popup.
      GET: async ({ request }) => {
        const auth = await authUser(request);
        if (!auth) return json({ error: "Invalid extension key" }, 401);
        const { data: gs } = await auth.admin
          .from("github_settings")
          .select("repo_owner,repo_name")
          .eq("user_id", auth.userId)
          .maybeSingle();
        const { data: conn } = await auth.admin
          .from("app_user_connections")
          .select("id")
          .eq("user_id", auth.userId)
          .eq("connector_id", "github")
          .maybeSingle();
        return json({
          ok: true,
          github: conn && gs?.repo_name ? `${gs.repo_owner}/${gs.repo_name}` : null,
        });
      },

      POST: async ({ request }) => {
        const auth = await authUser(request);
        if (!auth)
          return json(
            { error: "Invalid extension key. Generate a new one in CodeTracker → Settings." },
            401,
          );
        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch (e) {
          return json({ error: "Invalid data from extension", details: String(e) }, 400);
        }
        const { formatTopic, normalizeTopics } = await import("@/lib/topic-format");
        const { admin, userId } = auth;
        const link = `https://leetcode.com/problems/${body.slug}/`;
        const topics = normalizeTopics(body.topics.map(formatTopic));

        // ---- dedup save (same rule as the app: platform + problem_id, else name)
        type Row = {
          id: string;
          name: string;
          times_solved: number;
          date_first_solved: string;
          last_solved_date: string | null;
        };
        let existing: Row | null = null;
        if (body.problem_id) {
          const { data } = await admin
            .from("problems")
            .select("id,name,times_solved,date_first_solved,last_solved_date")
            .eq("user_id", userId)
            .eq("platform", "leetcode")
            .eq("problem_id", body.problem_id)
            .maybeSingle();
          existing = (data as Row) ?? null;
        }
        if (!existing) {
          const norm = body.title.trim().toLowerCase().replace(/\s+/g, " ");
          const { data } = await admin
            .from("problems")
            .select("id,name,times_solved,date_first_solved,last_solved_date")
            .eq("user_id", userId)
            .eq("platform", "leetcode");
          existing =
            ((data ?? []) as Row[]).find(
              (r) => r.name.trim().toLowerCase().replace(/\s+/g, " ") === norm,
            ) ?? null;
        }

        let problemRowId: string;
        let kind: "created" | "updated";
        let timesSolved = 1;
        if (existing) {
          const firstD =
            existing.date_first_solved < body.date ? existing.date_first_solved : body.date;
          const prevLast = existing.last_solved_date ?? existing.date_first_solved;
          const lastD = prevLast > body.date ? prevLast : body.date;
          timesSolved = (existing.times_solved ?? 1) + 1;
          const { error } = await admin
            .from("problems")
            .update({
              times_solved: timesSolved,
              date_first_solved: firstD,
              last_solved_date: lastD,
              last_revised_at: new Date().toISOString(),
              ...(body.notes.trim() ? { notes: body.notes } : {}),
              ...(body.hints.trim() ? { hints: body.hints } : {}),
              ...(body.time_taken_minutes != null
                ? { time_taken_minutes: body.time_taken_minutes }
                : {}),
              ...(body.status ? { status: body.status } : {}),
            })
            .eq("id", existing.id)
            .eq("user_id", userId);
          if (error) return json({ error: error.message }, 500);
          problemRowId = existing.id;
          kind = "updated";
        } else {
          const { data, error } = await admin
            .from("problems")
            .insert({
              user_id: userId,
              name: body.title,
              platform: "leetcode",
              problem_id: body.problem_id || null,
              link,
              difficulty: body.difficulty,
              topics,
              notes: body.notes || null,
              hints: body.hints || null,
              time_taken_minutes: body.time_taken_minutes ?? null,
              status: body.status ?? "solved",
              date_first_solved: body.date,
              last_solved_date: body.date,
            })
            .select("id")
            .single();
          if (error) return json({ error: error.message }, 500);
          problemRowId = data.id;
          kind = "created";
        }

        // ---- GitHub push (failure never undoes the save above)
        let githubUrl: string | null = null;
        let githubError: string | null = null;
        if (body.push_github && body.code.trim()) {
          try {
            const { data: gs } = await admin
              .from("github_settings")
              .select("repo_owner,repo_name")
              .eq("user_id", userId)
              .maybeSingle();
            const { data: conn } = await admin
              .from("app_user_connections")
              .select("id")
              .eq("user_id", userId)
              .eq("connector_id", "github")
              .maybeSingle();
            if (!conn || !gs?.repo_owner || !gs?.repo_name) {
              githubError = "GitHub isn't connected — set it up in CodeTracker → Settings.";
            } else {
              const { pushSolution } = await import("@/server/github.server");
              githubUrl = await pushSolution(
                userId,
                { owner: gs.repo_owner, name: gs.repo_name },
                {
                  problemId: body.problem_id,
                  slug: body.slug,
                  title: body.title,
                  difficulty: body.difficulty,
                  topics,
                  lang: body.lang,
                  code: body.code,
                  link,
                  minutes: body.time_taken_minutes ?? null,
                  date: body.date,
                },
              );
              await admin
                .from("problems")
                .update({ solution_link: githubUrl })
                .eq("id", problemRowId)
                .eq("user_id", userId);
            }
          } catch (e) {
            console.error("GitHub push failed", e);
            githubError = e instanceof Error ? e.message : "GitHub push failed";
          }
        }

        return json({
          ok: true,
          kind,
          times_solved: timesSolved,
          github_url: githubUrl,
          github_error: githubError,
        });
      },
    },
  },
});

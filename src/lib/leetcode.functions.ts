import { createServerFn } from "@tanstack/react-start";

export type LeetCodeImport = {
  name: string;
  slug: string;
  problem_id: string;
  difficulty: "easy" | "medium" | "hard";
  topics: string[];
  link: string;
};

function extractSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/leetcode\.com\/problems\/([a-z0-9-]+)/i);
  if (m) return m[1].toLowerCase();
  // treat as raw slug if it looks like one
  if (/^[a-z0-9-]+$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

export const importLeetCodeProblem = createServerFn({ method: "POST" })
  .inputValidator((data: { input: string }) => {
    if (typeof data?.input !== "string") throw new Error("input required");
    return data;
  })
  .handler(async ({ data }): Promise<LeetCodeImport> => {
    const slug = extractSlug(data.input);
    if (!slug) throw new Error("Enter a LeetCode problem URL or slug (e.g. two-sum)");

    const query = `query q($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionFrontendId
        title
        titleSlug
        difficulty
        topicTags { name }
      }
    }`;

    const res = await fetch("https://leetcode.com/graphql/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Referer: `https://leetcode.com/problems/${slug}/`,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      },
      body: JSON.stringify({ query, variables: { titleSlug: slug } }),
    });

    if (!res.ok) throw new Error(`LeetCode request failed (${res.status})`);
    const json = (await res.json()) as {
      data?: {
        question?: {
          questionFrontendId: string;
          title: string;
          titleSlug: string;
          difficulty: string;
          topicTags: { name: string }[];
        } | null;
      };
      errors?: { message: string }[];
    };
    const q = json?.data?.question;
    if (!q) throw new Error(json?.errors?.[0]?.message ?? "Problem not found");

    return {
      name: q.title,
      slug: q.titleSlug,
      problem_id: q.questionFrontendId,
      difficulty: q.difficulty.toLowerCase() as "easy" | "medium" | "hard",
      topics: q.topicTags.map((t) => t.name),
      link: `https://leetcode.com/problems/${q.titleSlug}/`,
    };
  });

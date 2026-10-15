import { localDate } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Problem = Database["public"]["Tables"]["problems"]["Row"];
export type ProblemInsert = Database["public"]["Tables"]["problems"]["Insert"];

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const PLATFORMS = ["leetcode", "codeforces", "other"] as const;
export const STATUSES = ["need_revision", "solved", "mastered", "forgotten"] as const;

export { formatTopic, normalizeTopics } from "@/lib/topic-format";
import { normalizeTopics } from "@/lib/topic-format";

export const COMMON_TOPICS = [
  "Array",
  "String",
  "Hash Table",
  "Linked List",
  "Stack",
  "Queue",
  "Tree",
  "Binary Tree",
  "Binary Search Tree",
  "Graph",
  "Heap",
  "Trie",
  "DP",
  "Greedy",
  "Binary Search",
  "Two Pointers",
  "Sliding Window",
  "Backtracking",
  "Bit Manipulation",
  "Math",
  "Recursion",
  "DFS",
  "BFS",
  "Union Find",
  "Segment Tree",
];

export async function fetchProblems() {
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export type SaveResult =
  | { kind: "created"; id: string }
  | {
      kind: "updated";
      id: string;
      times_solved: number;
      last_solved_date: string;
      name: string;
    };

/**
 * Insert a problem, or if the same problem (platform + problem_id, or
 * platform + normalized name when there's no problem_id) already exists
 * for this user, merge into the existing row instead of duplicating.
 * On merge: bump times_solved, refresh last_revised_at + last_solved_date,
 * preserve notes/topic/status/first-solved-date/etc.
 */
export async function saveProblemDedup(
  values: Omit<ProblemInsert, "user_id">,
  userId: string,
): Promise<SaveResult> {
  const solvedDate = values.date_first_solved ?? localDate(new Date().toISOString())!;

  type ExistingRow = {
    id: string;
    name: string;
    times_solved: number;
    date_first_solved: string;
    last_solved_date: string | null;
  };
  let existing: ExistingRow | null = null;

  const pid = values.problem_id?.trim();
  if (pid) {
    const { data } = await supabase
      .from("problems")
      .select("id,name,times_solved,date_first_solved,last_solved_date")
      .eq("user_id", userId)
      .eq("platform", values.platform ?? "other")
      .eq("problem_id", pid)
      .maybeSingle();
    if (data) existing = data as ExistingRow;
  }
  if (!existing) {
    const norm = normalizeName(values.name);
    const { data } = await supabase
      .from("problems")
      .select("id,name,times_solved,date_first_solved,last_solved_date")
      .eq("user_id", userId)
      .eq("platform", values.platform ?? "other");
    const match = ((data ?? []) as ExistingRow[]).find((r) => normalizeName(r.name) === norm);
    if (match) existing = match;
  }

  if (existing) {
    const firstD =
      existing.date_first_solved < solvedDate ? existing.date_first_solved : solvedDate;
    const prevLast = existing.last_solved_date ?? existing.date_first_solved;
    const lastD = prevLast > solvedDate ? prevLast : solvedDate;
    const nextCount = (existing.times_solved ?? 1) + 1;
    const { error } = await supabase
      .from("problems")
      .update({
        times_solved: nextCount,
        date_first_solved: firstD,
        last_solved_date: lastD,
        last_revised_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return {
      kind: "updated",
      id: existing.id,
      times_solved: nextCount,
      last_solved_date: lastD,
      name: existing.name,
    };
  }

  const { data, error } = await supabase
    .from("problems")
    .insert({
      ...values,
      topics: normalizeTopics(values.topics ?? []),
      user_id: userId,
      last_solved_date: solvedDate,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { kind: "created", id: data.id };
}

export async function fetchProblem(id: string) {
  const { data, error } = await supabase.from("problems").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchRecentRevisions(limit = 20) {
  const { data, error } = await supabase
    .from("revisions")
    .select("*, problem:problems(id,name,difficulty,platform)")
    .order("revised_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

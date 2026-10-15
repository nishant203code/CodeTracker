export const TOPIC_ACRONYMS = new Set([
  "DP",
  "BFS",
  "DFS",
  "DSU",
  "LCA",
  "MST",
  "KMP",
  "GCD",
  "LCM",
  "BIT",
  "API",
  "OOP",
  "DBMS",
  "OS",
]);

/** Case-insensitive topic formatting: "hash table" -> "Hash Table", "sql" -> "SQL". */
export function formatTopic(t: string): string {
  return t
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => {
      const up = w.toUpperCase();
      if (TOPIC_ACRONYMS.has(up)) return up;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function normalizeTopics(list: string[]): string[] {
  const out: string[] = [];
  for (const t of list) {
    const f = formatTopic(t);
    if (f && !out.some((x) => x.toLowerCase() === f.toLowerCase())) out.push(f);
  }
  return out;
}

import { localDate } from "@/lib/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { fetchProblems, DIFFICULTIES, PLATFORMS, STATUSES } from "@/lib/problems";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DifficultyBadge, StatusBadge, PlatformBadge } from "@/components/problem-badges";
import { Plus, Search, Star, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  q: z.string().optional(),
  difficulty: z.string().optional(),
  platform: z.string().optional(),
  status: z.string().optional(),
  fav: z.enum(["1"]).optional(),
});

const problemsQuery = () => queryOptions({ queryKey: ["problems"], queryFn: fetchProblems });

export const Route = createFileRoute("/_authenticated/problems/")({
  validateSearch: searchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(problemsQuery()),
  component: ProblemsList,
});

function ProblemsList() {
  const { data: problems } = useSuspenseQuery(problemsQuery());
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [qLocal, setQLocal] = useState(search.q ?? "");

  const update = (patch: Record<string, string | undefined>) =>
    navigate({
      to: "/problems",
      search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }),
    });

  const filtered = useMemo(() => {
    const q = (search.q ?? "").toLowerCase().trim();
    return problems.filter((p) => {
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.topics.some((t) => t.toLowerCase().includes(q))
      )
        return false;
      if (search.difficulty && p.difficulty !== search.difficulty) return false;
      if (search.platform && p.platform !== search.platform) return false;
      if (search.status && p.status !== search.status) return false;
      if (search.fav === "1" && !p.favorite) return false;
      return true;
    });
  }, [problems, search]);

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Problems</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {problems.length}
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/problems/new">
            <Plus className="mr-2 h-4 w-4" /> Add problem
          </Link>
        </Button>
      </div>

      <Card className="p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative sm:col-span-2 md:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={qLocal}
              onChange={(e) => setQLocal(e.target.value)}
              onBlur={() => update({ q: qLocal || undefined })}
              onKeyDown={(e) => {
                if (e.key === "Enter") update({ q: qLocal || undefined });
              }}
              placeholder="Search name or topic…"
              className="pl-9"
            />
          </div>
          <FilterSelect
            value={search.difficulty}
            onChange={(v) => update({ difficulty: v })}
            placeholder="Difficulty"
            options={DIFFICULTIES.map((d) => ({ value: d, label: cap(d) }))}
          />
          <FilterSelect
            value={search.platform}
            onChange={(v) => update({ platform: v })}
            placeholder="Platform"
            options={PLATFORMS.map((p) => ({
              value: p,
              label: p === "leetcode" ? "LeetCode" : p === "codeforces" ? "Codeforces" : "Other",
            }))}
          />
          <FilterSelect
            value={search.status}
            onChange={(v) => update({ status: v })}
            placeholder="Status"
            options={STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }))}
          />
          <Button
            variant={search.fav === "1" ? "default" : "outline"}
            size="icon"
            onClick={() => update({ fav: search.fav === "1" ? undefined : "1" })}
            aria-label="Favorites"
            className="justify-self-start"
          >
            <Star className={cn("h-4 w-4", search.fav === "1" && "fill-current")} />
          </Button>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {problems.length === 0
              ? "No problems yet. Add your first one!"
              : "No problems match these filters."}
          </p>
          {problems.length === 0 && (
            <Button asChild className="mt-4">
              <Link to="/problems/new">
                <Plus className="mr-2 h-4 w-4" /> Add problem
              </Link>
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/problems/$id"
                    params={{ id: p.id }}
                    className="flex min-w-0 items-center gap-2 font-medium hover:text-primary"
                  >
                    {p.favorite && (
                      <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" />
                    )}
                    <span className="break-words">{p.name}</span>
                  </Link>
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="shrink-0 text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <DifficultyBadge value={p.difficulty} />
                  <PlatformBadge value={p.platform} />
                  <StatusBadge value={p.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Solved ×{p.times_solved}</span>
                  <span>Last rev: {localDate(p.last_revised_at) ?? "—"}</span>
                </div>

                {p.topics.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.topics.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">Problem</th>
                    <th className="p-3 font-medium">Difficulty</th>
                    <th className="p-3 font-medium">Platform</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Solved</th>
                    <th className="p-3 font-medium">Times solved</th>
                    <th className="p-3 font-medium">Last revised</th>

                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border/40 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-xs p-3">
                        <Link
                          to="/problems/$id"
                          params={{ id: p.id }}
                          className="flex items-center gap-2 font-medium hover:text-primary"
                        >
                          {p.favorite && (
                            <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" />
                          )}
                          <span className="break-words">{p.name}</span>
                        </Link>
                        {p.topics.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.topics.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <DifficultyBadge value={p.difficulty} />
                      </td>
                      <td className="p-3">
                        <PlatformBadge value={p.platform} />
                      </td>
                      <td className="p-3">
                        <StatusBadge value={p.status} />
                      </td>
                      <td className="p-3 text-muted-foreground">{p.date_first_solved}</td>
                      <td className="p-3 text-muted-foreground">{p.times_solved}</td>
                      <td className="p-3 text-muted-foreground">
                        {localDate(p.last_revised_at) ?? "—"}
                      </td>

                      <td className="p-3 text-right">
                        {p.link && (
                          <a
                            href={p.link}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value ?? "__all"} onValueChange={(v) => onChange(v === "__all" ? undefined : v)}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">All {placeholder.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="capitalize">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

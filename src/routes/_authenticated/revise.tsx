import { localDate } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { fetchProblems } from "@/lib/problems";
import {
  pickSmartRevisionsScored,
  statusAfterOutcome,
  type RevisionOutcome,
  type ProblemStatus,
} from "@/lib/spaced-repetition";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DifficultyBadge, PlatformBadge, StatusBadge } from "@/components/problem-badges";
import { toast } from "sonner";
import {
  CheckCircle2,
  Frown,
  Rocket,
  RotateCcw,
  PartyPopper,
  Sparkles,
  Shuffle,
  ExternalLink,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
import type { Database } from "@/integrations/supabase/types";

type Problem = Database["public"]["Tables"]["problems"]["Row"];

const problemsQuery = () => queryOptions({ queryKey: ["problems"], queryFn: fetchProblems });

export const Route = createFileRoute("/_authenticated/revise")({
  loader: ({ context }) => context.queryClient.ensureQueryData(problemsQuery()),
  component: RevisePage,
});

const OUTCOMES: {
  key: RevisionOutcome;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "outline" | "secondary" | "destructive";
}[] = [
  { key: "solved_again", label: "Solved again", icon: CheckCircle2, variant: "default" },
  { key: "too_easy", label: "Too easy", icon: Rocket, variant: "secondary" },
  { key: "need_more_practice", label: "Need practice", icon: RotateCcw, variant: "outline" },
  { key: "forgot", label: "Forgot", icon: Frown, variant: "destructive" },
];

type Mode = "smart" | "topic";

const DAILY_DEFAULT = 3;

function RevisePage() {
  const { data: problems } = useSuspenseQuery(problemsQuery());
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>("smart");
  const [count, setCount] = useState<number>(DAILY_DEFAULT);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [includeMastered, setIncludeMastered] = useState(false);
  const [queue, setQueue] = useState<Problem[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);

  const allTopics = useMemo(() => {
    const s = new Set<string>();
    problems.forEach((p) => p.topics.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [problems]);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  async function pick(n: number, m: Mode = mode) {
    if (savingRef.current) return;
    const opts = m === "topic" ? { topics: selectedTopics, includeMastered } : { includeMastered };
    const scored = pickSmartRevisionsScored(problems, n, opts);
    if (scored.length === 0) {
      toast.error(
        m === "topic" && selectedTopics.length === 0
          ? "Select at least one topic"
          : "No problems match",
      );
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user!.id;
      const sessionId = crypto.randomUUID();
      const { error: sErr } = await supabase.from("revision_sessions").insert({
        id: sessionId,
        user_id: userId,
        mode: m,
        problem_count: scored.length,
      });
      if (sErr) throw sErr;
      const { error: iErr } = await supabase.from("revision_session_items").insert(
        scored.map(({ p, s }, i) => ({
          session_id: sessionId,
          user_id: userId,
          problem_id: p.id,
          position: i + 1,
          problem_name: p.name,
          priority_score: Math.round(s * 100) / 100,
          times_solved: p.times_solved,
          status: p.status,
          difficulty: p.difficulty,
        })),
      );
      if (iErr) throw iErr;
      qc.invalidateQueries({ queryKey: ["revision_sessions"] });
    } catch (e) {
      toast.error(`Could not save revision history: ${(e as Error).message}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    setQueue(scored.map((x) => x.p) as Problem[]);
    setCompleted(new Set());
    setActive(null);
  }

  const record = useMutation({
    mutationFn: async ({ problemId, outcome }: { problemId: string; outcome: RevisionOutcome }) => {
      const problem = problems.find((p) => p.id === problemId)!;
      const nextStatus = statusAfterOutcome(problem.status as ProblemStatus, outcome);
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user!.id;

      const { error: revErr } = await supabase.from("revisions").insert({
        user_id: userId,
        problem_id: problemId,
        outcome,
      });
      if (revErr) throw revErr;

      const { error: updErr } = await supabase
        .from("problems")
        .update({
          status: nextStatus,
          times_solved: (problem.times_solved ?? 1) + 1,
          last_revised_at: new Date().toISOString(),
        })
        .eq("id", problemId);
      if (updErr) throw updErr;
    },
    onSuccess: (_data, vars) => {
      setCompleted((c) => new Set(c).add(vars.problemId));
      setActive(null);
      qc.invalidateQueries({ queryKey: ["problems"] });
      qc.invalidateQueries({ queryKey: ["revisions", "recent"] });
      toast.success("Revision logged");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allDone = queue.length > 0 && completed.size >= queue.length;

  function toggleTopic(t: string) {
    setSelectedTopics((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Revise</h1>
        <p className="text-sm text-muted-foreground">
          Priority-weighted spaced repetition — Need Revision first, then Medium, Hard, Easy, and
          finally Mastered.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Today's revision
            </div>
            <div className="text-lg font-semibold">{DAILY_DEFAULT} priority questions</div>
          </div>
          <Button
            onClick={() => {
              setMode("smart");
              setCount(DAILY_DEFAULT);
              pick(DAILY_DEFAULT, "smart");
            }}
            disabled={problems.length === 0 || saving}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Start today's revision
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-5">
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Revision mode
          </Label>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as Mode)}
            className="grid gap-2 sm:grid-cols-2"
          >
            <ModeCard
              id="mode-smart"
              value="smart"
              icon={Sparkles}
              title="Smart"
              subtitle="Priority-weighted across all"
            />
            <ModeCard
              id="mode-topic"
              value="topic"
              icon={Shuffle}
              title="Topic-wise"
              subtitle="Filter by topics"
            />
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="count"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Number of questions
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="count"
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="w-28"
            />
            {[3, 5, 10, 20].map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={count === n ? "default" : "outline"}
                onClick={() => setCount(n)}
              >
                {n}
              </Button>
            ))}
            <label className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={includeMastered}
                onChange={(e) => setIncludeMastered(e.target.checked)}
                className="accent-primary"
              />
              Include mastered
            </label>
          </div>
        </div>

        {mode === "topic" && (
          <ChipPicker
            label={`Topics${selectedTopics.length ? ` (${selectedTopics.length})` : ""}`}
            items={allTopics}
            selected={selectedTopics}
            onToggle={toggleTopic}
            emptyMessage="No topics yet — add problems with topics first."
          />
        )}

        <Button
          onClick={() => pick(count)}
          disabled={problems.length === 0 || saving}
          className="w-full sm:w-auto"
        >
          <Sparkles className="mr-2 h-4 w-4" /> Generate revision
        </Button>
      </Card>

      {problems.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">Add problems to start revising.</p>
          <Button asChild className="mt-4">
            <Link to="/problems/new">Add your first problem</Link>
          </Button>
        </Card>
      ) : queue.length === 0 ? null : allDone ? (
        <Card className="p-10 text-center">
          <PartyPopper className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">Session complete</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {completed.size} problem{completed.size === 1 ? "" : "s"} revised.
          </p>
          <Button onClick={() => pick(count)} className="mt-4" variant="outline">
            Generate another set
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {completed.size} / {queue.length} complete
          </p>
          {queue.map((p) => {
            const isCompleted = completed.has(p.id);
            const isActive = active === p.id;
            return (
              <Card
                key={p.id}
                className={`p-5 transition-opacity ${isCompleted ? "opacity-50" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/problems/$id"
                        params={{ id: p.id }}
                        className="font-semibold hover:text-primary"
                      >
                        {p.name}
                      </Link>
                      {safeUrl(p.link) ? (
                        <a
                          href={safeUrl(p.link)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open original problem"
                          title="Open original problem"
                          className="shrink-0 text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <span
                          title="No problem link saved"
                          aria-label="No problem link saved"
                          className="shrink-0 text-muted-foreground/40"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <DifficultyBadge value={p.difficulty} />
                      <PlatformBadge value={p.platform} />
                      <StatusBadge value={p.status} />
                      {p.topics.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                      <span>First solved: {p.date_first_solved}</span>
                      <span>Times solved: {p.times_solved}</span>
                      <span>Last revised: {localDate(p.last_revised_at) ?? "—"}</span>
                    </div>
                  </div>
                  {!isCompleted && !isActive && (
                    <Button size="sm" onClick={() => setActive(p.id)}>
                      Start revision
                    </Button>
                  )}
                  {isCompleted && (
                    <span className="text-xs text-success">
                      <CheckCircle2 className="inline h-4 w-4" /> Done
                    </span>
                  )}
                </div>

                {isActive && (
                  <div className="mt-4 border-t border-border/60 pt-4">
                    <p className="mb-3 text-sm text-muted-foreground">How did it go?</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {OUTCOMES.map(({ key, label, icon: Icon, variant }) => (
                        <Button
                          key={key}
                          variant={variant}
                          size="sm"
                          disabled={record.isPending}
                          onClick={() => record.mutate({ problemId: p.id, outcome: key })}
                        >
                          <Icon className="mr-1 h-4 w-4" />
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <RevisionHistory
        onLoad={(ids) => {
          const byId = new Map(problems.map((p) => [p.id, p]));
          const restored = ids.map((id) => byId.get(id)).filter((p): p is Problem => !!p);
          if (restored.length === 0) {
            toast.error("Those problems are no longer in your list");
            return;
          }
          setQueue(restored);
          setCompleted(new Set());
          setActive(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}

function ModeCard({
  id,
  value,
  icon: Icon,
  title,
  subtitle,
}: {
  id: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 rounded-md border border-border/60 p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
    >
      <RadioGroupItem id={id} value={value} />
      <div>
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </label>
  );
}

function ChipPicker({
  label,
  items,
  selected,
  onToggle,
  emptyMessage,
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
  emptyMessage: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((t) => {
            const on = selected.includes(t);
            return (
              <button
                type="button"
                key={t}
                onClick={() => onToggle(t)}
                className={
                  "rounded-md border px-2.5 py-1 text-xs transition-colors " +
                  (on
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border/60 text-muted-foreground hover:bg-accent")
                }
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RevisionHistory({ onLoad }: { onLoad: (problemIds: string[]) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["revision_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revision_sessions")
        .select(
          "id, mode, problem_count, generated_at, items:revision_session_items(position, problem_id, problem_name, priority_score, times_solved, status, difficulty)",
        )
        .order("generated_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  return (
    <Card className="p-5 space-y-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Revision history
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No revision sessions generated yet.</p>
      ) : (
        <div className="space-y-2">
          {data.map((s) => (
            <details key={s.id} className="rounded-md border border-border/60 p-3">
              <summary className="cursor-pointer text-sm">
                <span className="font-medium">{new Date(s.generated_at).toLocaleString()}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {s.problem_count} problem{s.problem_count === 1 ? "" : "s"} · {s.mode}
                </span>
              </summary>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() =>
                  onLoad(
                    [...s.items]
                      .sort((a, b) => a.position - b.position)
                      .map((it) => it.problem_id)
                      .filter((id): id is string => !!id),
                  )
                }
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Load as revision cards
              </Button>
              <ul className="mt-2 space-y-1 text-xs">
                {[...s.items]
                  .sort((a, b) => a.position - b.position)
                  .map((it) => (
                    <li key={it.position} className="flex flex-wrap justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {it.position}. {it.problem_name}
                      </span>
                      <span className="text-muted-foreground">
                        score {Number(it.priority_score).toFixed(1)} · solved {it.times_solved}× ·{" "}
                        {it.status.replace("_", " ")}
                      </span>
                    </li>
                  ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </Card>
  );
}

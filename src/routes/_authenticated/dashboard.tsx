import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { fetchProblems, fetchRecentRevisions } from "@/lib/problems";
import { localDate } from "@/lib/utils";
import { format, startOfDay, subDays, differenceInCalendarDays } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ContributionHeatmap } from "@/components/heatmap";
import { DifficultyBadge, PlatformBadge } from "@/components/problem-badges";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, Sparkles, Target, TrendingUp, Trophy, Zap, Plus, Repeat } from "lucide-react";

const problemsQuery = () => queryOptions({ queryKey: ["problems"], queryFn: fetchProblems });
const revisionsQuery = () =>
  queryOptions({
    queryKey: ["revisions", "recent"],
    queryFn: () => fetchRecentRevisions(30),
  });

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(problemsQuery());
    context.queryClient.ensureQueryData(revisionsQuery());
  },
  component: Dashboard,
});

function Dashboard() {
  const { data: problems } = useSuspenseQuery(problemsQuery());
  const { data: revisions } = useSuspenseQuery(revisionsQuery());

  const today = format(startOfDay(new Date()), "yyyy-MM-dd");
  const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
  const monthAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const totalSolved = problems.length;
  // Solved today = brand-new problems first solved today.
  const solvedToday = problems.filter((p) => p.date_first_solved === today).length;
  // Revised today = older problems solved again or revised today (excludes new ones).
  const revisedToday = problems.filter(
    (p) =>
      p.date_first_solved !== today &&
      (p.last_solved_date === today ||
        (p.last_revised_at && localDate(p.last_revised_at) === today)),
  ).length;
  // "Today" = everything touched today (new + revised, each problem counted once).
  const todayTotal = new Set(
    problems
      .filter(
        (p) =>
          p.date_first_solved === today ||
          p.last_solved_date === today ||
          (p.last_revised_at && localDate(p.last_revised_at) === today),
      )
      .map((p) => p.id),
  ).size;
  const solvedThisWeek = problems.filter((p) => p.date_first_solved >= weekAgo).length;
  const solvedThisMonth = problems.filter((p) => p.date_first_solved >= monthAgo).length;

  const easy = problems.filter((p) => p.difficulty === "easy").length;
  const medium = problems.filter((p) => p.difficulty === "medium").length;
  const hard = problems.filter((p) => p.difficulty === "hard").length;

  const topicCounts: Record<string, number> = {};
  problems.forEach((p) => p.topics.forEach((t) => (topicCounts[t] = (topicCounts[t] || 0) + 1)));
  const topicEntries = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
  const mostSolvedTopic = topicEntries[0]?.[0] ?? "—";

  // Solving streak
  const solveDates = new Set(problems.map((p) => p.date_first_solved));
  const solvingStreak = computeStreak(solveDates);

  // Revision streak
  const revDates = new Set(revisions.map((r) => format(new Date(r.revised_at), "yyyy-MM-dd")));
  const revisionStreak = computeStreak(revDates);

  const heatmapData: Record<string, number> = {};
  problems.forEach((p) => {
    heatmapData[p.date_first_solved] = (heatmapData[p.date_first_solved] || 0) + 1;
  });

  const pieData = topicEntries.slice(0, 7).map(([name, value]) => ({ name, value }));
  const pieColors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
    "var(--color-chart-6)",
    "var(--color-chart-7)",
  ];

  const masteredCount = problems.filter((p) => p.status === "mastered").length;

  return (
    <div className="min-w-0 space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {totalSolved === 0
              ? "Start by adding your first problem."
              : `You've solved ${totalSolved} problem${totalSolved === 1 ? "" : "s"} · ${masteredCount} mastered.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/revise">
              <Repeat className="mr-2 h-4 w-4" /> Revise
            </Link>
          </Button>
          <Button asChild>
            <Link to="/problems/new">
              <Plus className="mr-2 h-4 w-4" /> Add problem
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total solved" value={totalSolved} icon={Target} />
        <StatCard label="Today" value={todayTotal} icon={Sparkles} />
        <StatCard label="This week" value={solvedThisWeek} icon={TrendingUp} />
        <StatCard label="This month" value={solvedThisMonth} icon={Trophy} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Solving streak" value={`${solvingStreak}d`} icon={Flame} accent />
        <StatCard label="Revision streak" value={`${revisionStreak}d`} icon={Zap} accent />
        <StatCard label="Solved today" value={solvedToday} icon={Sparkles} accent />
        <StatCard label="Revised today" value={revisedToday} icon={Repeat} accent />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-w-0 overflow-hidden p-4 sm:p-5 lg:col-span-2">
          <ContributionHeatmap data={heatmapData} />
        </Card>

        <Card className="min-w-0 p-4 sm:p-5">
          <h2 className="mb-1 font-semibold">Difficulty</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Most solved topic: <span className="text-foreground">{mostSolvedTopic}</span>
          </p>
          <DifficultyBar
            label="Easy"
            value={easy}
            total={totalSolved}
            className="bg-difficulty-easy"
          />
          <DifficultyBar
            label="Medium"
            value={medium}
            total={totalSolved}
            className="bg-difficulty-medium"
          />
          <DifficultyBar
            label="Hard"
            value={hard}
            total={totalSolved}
            className="bg-difficulty-hard"
          />
        </Card>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-4 sm:p-5">
          <h2 className="mb-4 font-semibold">Topics</h2>
          {pieData.length === 0 ? (
            <EmptyBlock label="No topics yet" />
          ) : (
            <div className="flex flex-col items-center gap-4 md:flex-row">
              <div className="h-52 w-full md:w-1/2">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={pieColors[i % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-1.5 text-sm md:w-1/2">
                {pieData.map((d, i) => (
                  <li key={d.name} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: pieColors[i % pieColors.length] }}
                    />
                    <span className="flex-1 truncate">{d.name}</span>
                    <span className="text-muted-foreground">{d.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="min-w-0 p-4 sm:p-5">
          <h2 className="mb-4 font-semibold">Recent activity</h2>
          {revisions.length === 0 && problems.length === 0 ? (
            <EmptyBlock label="Nothing yet — add a problem to get started." />
          ) : (
            <ul className="space-y-2">
              {[...problems].slice(0, 6).map((p) => (
                <li
                  key={p.id}
                  className="flex min-w-0 flex-wrap items-center gap-2 text-sm sm:flex-nowrap sm:gap-3"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    <Plus className="h-4 w-4" />
                  </span>
                  <Link
                    to="/problems/$id"
                    params={{ id: p.id }}
                    className="min-w-0 flex-1 basis-[60%] truncate hover:text-primary sm:basis-auto"
                  >
                    {p.name}
                  </Link>
                  <DifficultyBadge value={p.difficulty} />
                  <PlatformBadge value={p.platform} />
                  <span className="text-xs text-muted-foreground">
                    {relativeDays(p.date_first_solved)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={accent ? "h-4 w-4 text-primary" : "h-4 w-4 text-muted-foreground"} />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "warning" | "info" | "success";
}) {
  const tones: Record<typeof tone, string> = {
    primary: "text-primary",
    warning: "text-warning",
    info: "text-info",
    success: "text-success",
  };
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function DifficultyBar({
  label,
  value,
  total,
  className,
}: {
  label: string;
  value: number;
  total: number;
  className: string;
}) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {value} · {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="grid h-24 place-items-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
      {label}
    </div>
  );
}

function computeStreak(dates: Set<string>) {
  let streak = 0;
  const cursor = startOfDay(new Date());
  // If today has no entry, streak still counts from most recent day (start counting from yesterday)
  if (!dates.has(format(cursor, "yyyy-MM-dd"))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dates.has(format(cursor, "yyyy-MM-dd"))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function relativeDays(iso: string) {
  const d = differenceInCalendarDays(new Date(), new Date(iso));
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { fetchProblems, fetchRecentRevisions } from "@/lib/problems";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { useMemo } from "react";

const problemsQuery = () => queryOptions({ queryKey: ["problems"], queryFn: fetchProblems });
const revisionsQuery = () =>
  queryOptions({
    queryKey: ["revisions", "recent"],
    queryFn: () => fetchRecentRevisions(200),
  });

export const Route = createFileRoute("/_authenticated/analytics")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(problemsQuery());
    context.queryClient.ensureQueryData(revisionsQuery());
  },
  component: Analytics,
});

function Analytics() {
  const { data: problems } = useSuspenseQuery(problemsQuery());

  const solvedOverTime = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
    return days.map((d) => {
      const iso = format(d, "yyyy-MM-dd");
      return {
        date: format(d, "MMM d"),
        solved: problems.filter((p) => p.date_first_solved === iso).length,
      };
    });
  }, [problems]);

  const topicPerf = useMemo(() => {
    const map: Record<string, { total: number; revisions: number }> = {};
    problems.forEach((p) => {
      p.topics.forEach((t) => {
        if (!map[t]) map[t] = { total: 0, revisions: 0 };
        map[t].total++;
        map[t].revisions += Math.max(0, (p.times_solved ?? 1) - 1);
      });
    });
    return Object.entries(map)
      .map(([topic, v]) => ({
        topic,
        count: v.total,
        avgRevisions: v.total ? Number((v.revisions / v.total).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [problems]);

  const mostRevised = [...topicPerf].sort((a, b) => b.avgRevisions - a.avgRevisions).slice(0, 5);
  const leastRevised = [...topicPerf].sort((a, b) => a.avgRevisions - b.avgRevisions).slice(0, 5);

  const statusMix = useMemo(() => {
    const labels: Record<string, string> = {
      need_revision: "Need revision",
      solved: "Solved",
      mastered: "Mastered",
      forgotten: "Forgotten",
    };
    return Object.entries(labels).map(([k, name]) => ({
      name,
      value: problems.filter((p) => p.status === k).length,
    }));
  }, [problems]);

  const weekdays = useMemo(() => {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = new Array(7).fill(0);
    problems.forEach((p) => {
      if (p.date_first_solved) counts[new Date(p.date_first_solved + "T00:00:00").getDay()]++;
    });
    return names.map((day, i) => ({ day, solved: counts[i] }));
  }, [problems]);

  const stale = useMemo(() => {
    const now = Date.now();
    return problems
      .filter((p) => p.status !== "mastered")
      .map((p) => {
        const last = p.last_revised_at
          ? new Date(p.last_revised_at).getTime()
          : new Date((p.last_solved_date || p.date_first_solved) + "T00:00:00").getTime();
        return { p, days: Math.floor((now - last) / 86400000) };
      })
      .sort((a, b) => b.days - a.days)
      .slice(0, 6);
  }, [problems]);

  const weakTopics = useMemo(() => {
    const map: Record<string, { total: number; weak: number }> = {};
    problems.forEach((p) =>
      p.topics.forEach((t) => {
        if (!map[t]) map[t] = { total: 0, weak: 0 };
        map[t].total++;
        if (p.status === "need_revision" || p.status === "forgotten") map[t].weak++;
      }),
    );
    return Object.entries(map)
      .filter(([, v]) => v.total >= 2 && v.weak > 0)
      .map(([topic, v]) => ({ topic, ...v, pct: Math.round((v.weak / v.total) * 100) }))
      .sort((a, b) => b.pct - a.pct || b.weak - a.weak)
      .slice(0, 6);
  }, [problems]);

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Trends across your solving and revision.</p>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Problems solved (last 30 days)</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={solvedOverTime}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="solved"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Top topics</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={topicPerf} layout="vertical" margin={{ left: 20 }}>
                <XAxis
                  type="number"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="topic"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  width={90}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-semibold">Where your problems stand</h2>
          <p className="mb-3 text-xs text-muted-foreground">Count of problems by current status.</p>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={statusMix}>
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={10} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="value"
                  name="Problems"
                  fill="var(--color-primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-1 font-semibold">Your best practice days</h2>
        <p className="mb-3 text-xs text-muted-foreground">Problems solved by day of the week.</p>
        <div className="h-60">
          <ResponsiveContainer>
            <BarChart data={weekdays}>
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="solved"
                name="Solved"
                fill="var(--color-accent)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-1 font-semibold">Weak topics</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Share of problems marked Need revision or Forgotten.
          </p>
          {weakTopics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No weak topics right now.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {weakTopics.map((t) => (
                <li key={t.topic} className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="flex-1 truncate">{t.topic}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.weak}/{t.total}
                    </span>
                    <span className="w-10 text-right font-mono text-xs text-primary">{t.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${t.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 font-semibold">Going stale</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Not touched for the longest time (excluding Mastered).
          </p>
          {stale.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stale.map(({ p, days }) => (
                <li key={p.id} className="flex min-w-0 items-center gap-3">
                  <Link
                    to="/problems/$id"
                    params={{ id: p.id }}
                    className="flex-1 truncate hover:text-primary"
                  >
                    {p.name}
                  </Link>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {days}d ago
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Most revised topics</h2>
          <TopicList rows={mostRevised} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Least revised topics</h2>
          <TopicList rows={leastRevised} />
        </Card>
      </div>
    </div>
  );
}

function TopicList({ rows }: { rows: { topic: string; count: number; avgRevisions: number }[] }) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">Not enough data yet.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.topic} className="flex items-center gap-3">
          <span className="flex-1">{r.topic}</span>
          <span className="text-xs text-muted-foreground">{r.count} solved</span>
          <span className="font-mono text-xs text-primary">
            {r.avgRevisions.toFixed(1)} revisions/problem
          </span>
        </li>
      ))}
    </ul>
  );
}

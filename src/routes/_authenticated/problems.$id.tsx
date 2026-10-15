import { normalizeTopics } from "@/lib/problems";
import { localDate } from "@/lib/utils";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProblem } from "@/lib/problems";
import { ProblemForm, type ProblemFormValues } from "@/components/problem-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DifficultyBadge, StatusBadge, PlatformBadge } from "@/components/problem-badges";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Star, Trash2 } from "lucide-react";
import { useState } from "react";

const problemQuery = (id: string) =>
  queryOptions({ queryKey: ["problems", id], queryFn: () => fetchProblem(id) });

export const Route = createFileRoute("/_authenticated/problems/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(problemQuery(params.id)),
  component: ProblemDetail,
});

function ProblemDetail() {
  const { id } = Route.useParams();
  const { data: problem } = useSuspenseQuery(problemQuery(id));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const update = useMutation({
    mutationFn: async (values: Partial<ProblemFormValues> & { favorite?: boolean }) => {
      const { error } = await supabase
        .from("problems")
        .update({ ...values, topics: normalizeTopics(values.topics ?? []) })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["problems"] });
      qc.invalidateQueries({ queryKey: ["problems", id] });
      setEditing(false);
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("problems").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["problems"] });
      toast.success("Deleted");
      navigate({ to: "/problems" });
    },
  });

  if (editing) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 animate-fade-up">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Cancel
        </Button>
        <ProblemForm
          initial={problem}
          onSubmit={(v) => update.mutate(v)}
          onCancel={() => setEditing(false)}
          submitting={update.isPending}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-up">
      <Button asChild variant="ghost" size="sm">
        <Link to="/problems">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to problems
        </Link>
      </Button>

      <Card className="min-w-0 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">
              {problem.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DifficultyBadge value={problem.difficulty} />
              <PlatformBadge value={problem.platform} />
              <StatusBadge value={problem.status} />
              {problem.link && (
                <a
                  href={problem.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => update.mutate({ favorite: !problem.favorite })}
            >
              <Star
                className={`mr-1 h-4 w-4 ${problem.favorite ? "fill-warning text-warning" : ""}`}
              />
              {problem.favorite ? "Favorited" : "Favorite"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Delete this problem? This cannot be undone.")) del.mutate();
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          <MetaItem label="First solved" value={problem.date_first_solved} />
          <MetaItem
            label="Last solved"
            value={problem.last_solved_date ?? problem.date_first_solved}
          />
          <MetaItem label="Times solved" value={String(problem.times_solved)} />
          <MetaItem label="Last revised" value={localDate(problem.last_revised_at) ?? "—"} />

          <MetaItem
            label="Time taken"
            value={problem.time_taken_minutes ? `${problem.time_taken_minutes}m` : "—"}
          />
          <MetaItem label="Problem ID" value={problem.problem_id ?? "—"} />
        </div>

        {problem.topics.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Topics
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {problem.topics.map((t) => (
                <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {problem.notes && (
        <Card className="min-w-0 p-4 sm:p-6">
          <h3 className="mb-2 font-semibold">Notes</h3>
          <pre className="whitespace-pre-wrap [overflow-wrap:anywhere] font-sans text-sm text-muted-foreground">
            {problem.notes}
          </pre>
        </Card>
      )}
      {problem.hints && (
        <Card className="min-w-0 p-4 sm:p-6">
          <h3 className="mb-2 font-semibold">Hints</h3>
          <pre className="whitespace-pre-wrap [overflow-wrap:anywhere] font-sans text-sm text-muted-foreground">
            {problem.hints}
          </pre>
        </Card>
      )}
      {problem.solution_link && (
        <Card className="min-w-0 p-4 sm:p-6">
          <h3 className="mb-2 font-semibold">My solution</h3>
          <a
            href={problem.solution_link}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-primary [overflow-wrap:anywhere] hover:underline"
          >
            {problem.solution_link} <ExternalLink className="inline h-3 w-3" />
          </a>
        </Card>
      )}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}

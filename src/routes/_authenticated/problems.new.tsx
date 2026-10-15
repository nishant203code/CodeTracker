import { normalizeTopics } from "@/lib/problems";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { saveProblemDedup } from "@/lib/problems";
import { ProblemForm, type ProblemFormValues } from "@/components/problem-form";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { importLeetCodeProblem } from "@/lib/leetcode.functions";

export const Route = createFileRoute("/_authenticated/problems/new")({
  component: NewProblem,
});

function NewProblem() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [prefill, setPrefill] = useState<Partial<ProblemFormValues> | undefined>();
  const [lcInput, setLcInput] = useState("");
  const [formKey, setFormKey] = useState(0);

  const importLc = useMutation({
    mutationFn: (input: string) => importLeetCodeProblem({ data: { input } }),
    onSuccess: (r) => {
      setPrefill({
        name: r.name,
        link: r.link,
        platform: "leetcode",
        problem_id: r.problem_id,
        difficulty: r.difficulty,
        topics: normalizeTopics(r.topics),
      });
      setFormKey((k) => k + 1);
      toast.success(`Imported "${r.name}"`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async (values: ProblemFormValues) => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not signed in");
      return saveProblemDedup(values, userId);
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["problems"] });
      if (result.kind === "updated") {
        toast.success(`Problem already exists. Times Solved updated to ${result.times_solved}.`);
      } else {
        toast.success("Problem added");
      }
      navigate({ to: "/problems/$id", params: { id: result.id } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add problem</h1>
        <p className="text-sm text-muted-foreground">
          Paste a LeetCode URL to auto-fill, or log it manually.
        </p>
      </div>

      <Card className="p-4">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Import from LeetCode
        </label>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (lcInput.trim()) importLc.mutate(lcInput);
          }}
        >
          <Input
            value={lcInput}
            onChange={(e) => setLcInput(e.target.value)}
            placeholder="https://leetcode.com/problems/two-sum/  or  two-sum"
          />
          <Button type="submit" disabled={importLc.isPending || !lcInput.trim()}>
            {importLc.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Fetch
              </>
            )}
          </Button>
        </form>
      </Card>

      <ProblemForm
        key={formKey}
        prefill={prefill}
        onSubmit={(v) => save.mutate(v)}
        submitting={save.isPending}
        onCancel={() => navigate({ to: "/problems" })}
      />
    </div>
  );
}

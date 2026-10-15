import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIFFICULTIES, PLATFORMS, STATUSES, COMMON_TOPICS, formatTopic } from "@/lib/problems";
import { X, Loader2, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Problem = Database["public"]["Tables"]["problems"]["Row"];

export interface ProblemFormValues {
  name: string;
  link: string | null;
  platform: Database["public"]["Enums"]["platform_type"];
  problem_id: string | null;
  difficulty: Database["public"]["Enums"]["difficulty_level"];
  topics: string[];
  notes: string | null;
  hints: string | null;
  solution_link: string | null;
  status: Database["public"]["Enums"]["problem_status"];
  time_taken_minutes: number | null;
  date_first_solved: string; // YYYY-MM-DD
}

const today = () => format(new Date(), "yyyy-MM-dd");

const empty = (): ProblemFormValues => ({
  name: "",
  link: null,
  platform: "leetcode",
  problem_id: null,
  difficulty: "medium",
  topics: [],
  notes: null,
  hints: null,
  solution_link: null,
  status: "solved",
  time_taken_minutes: null,
  date_first_solved: today(),
});

export function ProblemForm({
  initial,
  prefill,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Problem;
  prefill?: Partial<ProblemFormValues>;
  onSubmit: (v: ProblemFormValues) => void;
  onCancel?: () => void;
  submitting?: boolean;
}) {
  const [v, setV] = useState<ProblemFormValues>(() =>
    initial
      ? {
          name: initial.name,
          link: initial.link,
          platform: initial.platform,
          problem_id: initial.problem_id,
          difficulty: initial.difficulty,
          topics: initial.topics,
          notes: initial.notes,
          hints: initial.hints,
          solution_link: initial.solution_link,
          status: initial.status,
          time_taken_minutes: initial.time_taken_minutes,
          date_first_solved: initial.date_first_solved,
        }
      : { ...empty(), ...(prefill ?? {}) },
  );
  const [topicInput, setTopicInput] = useState("");

  function addTopic(t: string) {
    const clean = formatTopic(t);
    if (!clean || v.topics.some((x) => x.toLowerCase() === clean.toLowerCase())) return;
    setV({ ...v, topics: [...v.topics, clean] });
    setTopicInput("");
  }

  function removeTopic(t: string) {
    setV({ ...v, topics: v.topics.filter((x) => x !== t) });
  }

  const solvedDate = v.date_first_solved ? new Date(v.date_first_solved + "T00:00:00") : undefined;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
      className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <Input
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
            required
            maxLength={200}
          />
        </Field>
        <Field label="Link">
          <Input
            type="url"
            value={v.link ?? ""}
            onChange={(e) => setV({ ...v, link: e.target.value || null })}
            placeholder="https://…"
          />
        </Field>
        <Field label="Platform">
          <Select
            value={v.platform}
            onValueChange={(x) => setV({ ...v, platform: x as ProblemFormValues["platform"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p === "leetcode" ? "LeetCode" : p === "codeforces" ? "Codeforces" : "Other"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Problem ID">
          <Input
            value={v.problem_id ?? ""}
            onChange={(e) => setV({ ...v, problem_id: e.target.value || null })}
            placeholder="e.g. 1234A or 1"
          />
        </Field>
        <Field label="Difficulty">
          <Select
            value={v.difficulty}
            onValueChange={(x) => setV({ ...v, difficulty: x as ProblemFormValues["difficulty"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d} value={d} className="capitalize">
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select
            value={v.status}
            onValueChange={(x) => setV({ ...v, status: x as ProblemFormValues["status"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Solved date">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !solvedDate && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {solvedDate ? format(solvedDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={solvedDate}
                onSelect={(d) => d && setV({ ...v, date_first_solved: format(d, "yyyy-MM-dd") })}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </Field>
        <Field label="Time taken (min)">
          <Input
            type="number"
            min={0}
            value={v.time_taken_minutes ?? ""}
            onChange={(e) =>
              setV({
                ...v,
                time_taken_minutes: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </Field>
      </div>

      <Field label="Topics">
        <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2 min-h-10">
          {v.topics.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-xs text-primary"
            >
              {t}
              <button type="button" onClick={() => removeTopic(t)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTopic(topicInput);
              }
            }}
            placeholder="Type a topic and press Enter"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {COMMON_TOPICS.filter((t) => !v.topics.some((x) => x.toLowerCase() === t.toLowerCase()))
            .slice(0, 10)
            .map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addTopic(t)}
                className="rounded-md border border-border/60 whitespace-nowrap px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
              >
                + {t}
              </button>
            ))}
        </div>
      </Field>

      <Field label="Solution link">
        <Input
          type="url"
          value={v.solution_link ?? ""}
          onChange={(e) => setV({ ...v, solution_link: e.target.value || null })}
          placeholder="GitHub / Gist URL"
        />
      </Field>

      <Field label="Notes">
        <Textarea
          rows={5}
          value={v.notes ?? ""}
          onChange={(e) => setV({ ...v, notes: e.target.value || null })}
          placeholder="Optimal approach, mistakes, edge cases…"
        />
      </Field>

      <Field label="Hints">
        <Textarea
          rows={3}
          value={v.hints ?? ""}
          onChange={(e) => setV({ ...v, hints: e.target.value || null })}
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

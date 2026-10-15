import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Difficulty = Database["public"]["Enums"]["difficulty_level"];
type Status = Database["public"]["Enums"]["problem_status"];
type Platform = Database["public"]["Enums"]["platform_type"];

export function DifficultyBadge({ value }: { value: Difficulty }) {
  const map: Record<Difficulty, string> = {
    easy: "bg-difficulty-easy/15 text-difficulty-easy border-difficulty-easy/30",
    medium: "bg-difficulty-medium/15 text-difficulty-medium border-difficulty-medium/30",
    hard: "bg-difficulty-hard/15 text-difficulty-hard border-difficulty-hard/30",
  };
  return (
    <Badge variant="outline" className={cn("capitalize", map[value])}>
      {value}
    </Badge>
  );
}

export function StatusBadge({ value }: { value: Status }) {
  const label: Partial<Record<Status, string>> = {
    solved: "Solved",
    need_revision: "Needs revision",
    mastered: "Mastered",
    forgotten: "Forgotten",
  };
  const map: Partial<Record<Status, string>> = {
    solved: "bg-info/15 text-info border-info/30",
    need_revision: "bg-warning/15 text-warning border-warning/30",
    mastered: "bg-success/15 text-success border-success/30",
    forgotten: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <Badge variant="outline" className={map[value] ?? map.need_revision}>
      {label[value] ?? "Needs revision"}
    </Badge>
  );
}

export function PlatformBadge({ value }: { value: Platform }) {
  const label: Record<Platform, string> = {
    leetcode: "LeetCode",
    codeforces: "Codeforces",
    other: "Other",
  };
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {label[value]}
    </Badge>
  );
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format, startOfDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HeatmapProps {
  /** Map of ISO date (YYYY-MM-DD) → count */
  data: Record<string, number>;
}

type Cell = { iso: string; count: number } | null;
interface MonthBlock {
  key: string;
  label: string;
  weeks: Cell[][];
}

const bucket = (n: number) => {
  if (n === 0) return "bg-heat-0";
  if (n === 1) return "bg-heat-1";
  if (n <= 3) return "bg-heat-2";
  if (n <= 6) return "bg-heat-3";
  return "bg-heat-4";
};

// Scrolls before first paint in the browser; plain effect during SSR.
const useLayoutEffectSafe = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function ContributionHeatmap({ data }: HeatmapProps) {
  const [range, setRange] = useState<string>("current");
  const [hover, setHover] = useState<{ text: string; x: number; y: number } | null>(null);

  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear()]);
    Object.keys(data).forEach((k) => ys.add(Number(k.slice(0, 4))));
    return [...ys].filter((y) => !Number.isNaN(y)).sort((a, b) => b - a);
  }, [data]);

  const { blocks, total, activeDays, maxStreak } = useMemo(() => {
    const today = startOfDay(new Date());
    let start: Date, end: Date;
    if (range === "current") {
      start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      end = today;
    } else {
      const y = Number(range);
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31);
    }

    const blocks: MonthBlock[] = [];
    let total = 0,
      activeDays = 0,
      streak = 0,
      maxStreak = 0;
    const m = new Date(start);
    while (m <= end) {
      const first = new Date(m.getFullYear(), m.getMonth(), 1);
      const weeks: Cell[][] = [];
      let week: Cell[] = Array(first.getDay()).fill(null);
      const d = new Date(first);
      while (d.getMonth() === first.getMonth() && d <= end) {
        const iso = format(d, "yyyy-MM-dd");
        const count = data[iso] ?? 0;
        total += count;
        if (count > 0) {
          activeDays++;
          streak++;
          maxStreak = Math.max(maxStreak, streak);
        } else streak = 0;
        week.push({ iso, count });
        if (week.length === 7) {
          weeks.push(week);
          week = [];
        }
        d.setDate(d.getDate() + 1);
      }
      if (week.length) {
        while (week.length < 7) week.push(null);
        weeks.push(week);
      }
      blocks.push({ key: format(first, "yyyy-MM"), label: format(first, "MMM"), weeks });
      m.setMonth(m.getMonth() + 1);
    }
    return { blocks, total, activeDays, maxStreak };
  }, [data, range]);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Land on the most recent months; the user swipes left for older ones.
  useLayoutEffectSafe(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [range, blocks]);

  return (
    <div data-heatmap-root className="relative w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-semibold">{total}</span>
          <span className="text-sm text-muted-foreground">
            problems solved {range === "current" ? "in the past one year" : `in ${range}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>
            Total active days: <span className="font-semibold text-foreground">{activeDays}</span>
          </span>
          <span>
            Max streak: <span className="font-semibold text-foreground">{maxStreak}</span>
          </span>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div ref={scrollRef} className="scrollbar-themed overflow-x-auto pb-2">
        <div className="flex w-max gap-2.5">
          {blocks.map((b) => (
            <div key={b.key} className="flex flex-col items-center">
              <div className="flex gap-[3px]">
                {b.weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((c, di) =>
                      c ? (
                        <div
                          key={c.iso}
                          onMouseEnter={(e) => {
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const host = (e.currentTarget as HTMLElement)
                              .closest("[data-heatmap-root]")!
                              .getBoundingClientRect();
                            setHover({
                              text: `${c.count} problem${c.count === 1 ? "" : "s"} solved on ${format(parseISO(c.iso), "MMM d, yyyy")}`,
                              x: r.left - host.left + r.width / 2,
                              y: r.top - host.top,
                            });
                          }}
                          onMouseLeave={() => setHover(null)}
                          className={cn(
                            "h-3 w-3 rounded-[3px] transition-colors hover:ring-1 hover:ring-foreground/60",
                            bucket(c.count),
                          )}
                        />
                      ) : (
                        <div key={di} className="h-3 w-3" />
                      ),
                    )}
                  </div>
                ))}
              </div>
              <span className="mt-2 text-xs text-muted-foreground">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0">
        {hover && (
          <div
            className="absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
            style={{ left: hover.x, top: hover.y - 6 }}
          >
            {hover.text}
          </div>
        )}
      </div>
    </div>
  );
}

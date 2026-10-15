import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Code2, Brain, Flame, LineChart } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Code2 className="h-4 w-4" />
          </span>
          <span>CodeTracker</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth" search={{ mode: "signup" }}>
              Get started
            </Link>
          </Button>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6">
        <section className="pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="mx-auto max-w-3xl text-center animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Spaced repetition for competitive programmers
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
              Never forget a solved <span className="text-gradient-primary">problem</span> again.
            </h1>
            <p className="mt-5 text-base text-muted-foreground md:text-lg">
              Track every LeetCode and Codeforces problem you solve. CodeTracker schedules 3
              revision problems each day using spaced repetition, so your recall compounds over
              time.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Start tracking free
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 pb-24 md:grid-cols-3">
          {[
            {
              icon: Brain,
              title: "Spaced revision",
              body: "1, 3, 7, 14, 30, 60, 120 day intervals with weighted smart revision.",
            },
            {
              icon: Flame,
              title: "Streaks & heatmap",
              body: "GitHub-style contribution graph for solving and revising.",
            },
            {
              icon: LineChart,
              title: "Deep analytics",
              body: "Topic strength, difficulty split, weakest areas.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="card-glass rounded-2xl p-6 transition-colors hover:border-primary/40"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        CodeTracker © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

"use client";
import * as React from "react"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { initParticles } from "../lib/particles";

type Article = {
  id: string;
  title: string;
  url: string;
  summary: string;
  importance_score: number;
};


function ScoreBadge({ score }: { score: number }) {
  if (score >= 75) return <Badge className="shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/10">{score}</Badge>;
  if (score >= 40) return <Badge className="shrink-0 bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/10">{score}</Badge>;
  return <Badge variant="outline" className="shrink-0 text-muted-foreground">{score}</Badge>;
}

export default function Home() {
  const [profession, setProfession] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  
  React.useEffect(() => {
    initParticles(60);

  }, []);

  async function handleRun() {
    if (!profession.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          profession,
          from: date?.from?.toISOString(),
          to: date?.to?.toISOString(),
        }),
      });
      const res = await fetch(`/api/articles?from=${date?.from?.toISOString()}&to=${date?.to?.toISOString()}`);
      setArticles(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen relative">
      <div className="relative z-10 max-w-2xl mx-auto px-6 py-16">

        <div className="max-w-2xl mx-auto px-6 py-16">

          <div className="mb-12">
            <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase mb-3">
              Hacker News × AI
            </p>
            <h1 className="text-5xl font-bold tracking-tight mb-3">ASORT</h1>
            <p className="text-muted-foreground leading-relaxed">
              Enter your profession and get today's top Hacker News stories ranked by relevance to your work.
            </p>
          </div>

          <div className="flex gap-2 mb-12">
            <Input
              value={profession}
              onChange={e => setProfession(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRun()}
              placeholder="e.g. ML engineer at a biotech startup"
              className="h-11"
            />

            <Popover>
              <PopoverTrigger className="h-11 shrink-0 border rounded-md px-4 text-sm">
                {date?.from && date?.to
                  ? `${date.from.toLocaleDateString()} – ${date.to.toLocaleDateString()}`
                  : "Pick dates"}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={date}
                  onSelect={setDate}
                  captionLayout="dropdown"
                />
              </PopoverContent>
            </Popover>

            <Button
              onClick={handleRun}
              disabled={loading || !profession.trim()}
              className="h-11 px-6 shrink-0"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Running
                </span>
              ) : "Sort"}
            </Button>
          </div>

          {loading && (
            <div className="text-sm text-muted-foreground space-y-1 mb-8 font-mono">
              <p>→ Scoring relevance with Claude...</p>
              <p>→ Summarizing top articles...</p>
            </div>
          )}

          {articles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Top <span className="font-medium text-foreground">{articles.length}</span> results for{" "}
                  <span className="font-medium text-foreground italic">{profession}</span>
                </p>
              </div>
              <Separator className="mb-6" />
              <div className="space-y-px">
                {articles.map((a, i) => (
                  <Card key={a.id} className="rounded-lg border shadow-none py-0 mb-3 px-2">
                    <CardContent className="px-0 py-5">
                      <div className="flex items-start gap-4">
                        <span className="text-xs font-mono text-muted-foreground mt-1 w-4 shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium leading-snug hover:underline underline-offset-4"
                            >
                              {a.title}
                            </a>
                            <ScoreBadge score={a.importance_score} />
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {a.summary}
                          </p>
                          <a
                            href={a.original_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-foreground/60 hover:underline underline-offset-4 truncate block"
                          >
                            {a.original_url}
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

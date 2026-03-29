import { NextRequest, NextResponse } from "next/server";
import { scrapeToday } from "@/lib/scraper";
import { score } from "@/lib/scorer";
import { save } from "@/lib/db";
import { summarizeArticles } from "@/lib/summarizer";

export async function POST(req: NextRequest) {
  const { profession } = await req.json();
  if (!profession) return NextResponse.json({ error: "No profession" }, { status: 400 });

  const articles = await scrapeToday();
  const scores = await score(articles, profession);
  await save(articles, scores);
  await summarizeArticles(3);

  return NextResponse.json({ ok: true });
}

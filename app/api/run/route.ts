import { NextRequest, NextResponse } from "next/server";
import { scrape } from "@/lib/scraper";
import { score } from "@/lib/scorer";
import { save } from "@/lib/db";
import { summarizeArticles } from "@/lib/summarizer";

export async function POST(req: NextRequest) {
  const { profession, from, to } = await req.json();

  if (!profession) return NextResponse.json({ error: "No profession" }, { status: 400 });
  if (!from) return NextResponse.json({error: "No date selected"}, { status: 400 });

  const articles = await scrape(from, to ?? from);
  const scores = await score(articles, profession);
  await save(articles, scores);
  await summarizeArticles(5);

  return NextResponse.json({ ok: true });
}

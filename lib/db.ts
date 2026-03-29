import { supabase } from "./supabase";

function getCurrentDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function save(
  articles: { title: string; url: string; published_at: string }[],
  scores: { index: number; score: number; summary: string }[]
) {
  console.log("Saving to Supabase...");

  for (const s of scores) {
    const article = articles[s.index - 1];
    const { error } = await supabase.from("articles").upsert(
      {
        title: article.title,
        url: article.url,
        source: "hackernews",
        published_at: article.published_at,
        importance_score: s.score,
        summary: s.summary,
      },
      { onConflict: "url" }
    );
    if (error) console.error("Insert error:", error.message);
  }
}

export async function display() {
  const { data } = await supabase
    .from("articles")
    .select("*")
    .eq("published_at", getCurrentDate())
    .order("importance_score", { ascending: false })
    .limit(10);

  console.log("\nTop Articles Today:\n");
  data?.forEach((a) => {
    console.log(`[${a.importance_score}/100] ${a.title}`);
    console.log(`  → ${a.summary}`);
    console.log(`  ${a.url}\n`);
  });
}

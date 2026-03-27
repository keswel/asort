import axios from "axios";
import * as readline from "readline";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

let prompt: string = `Score each headline 1-10 for importance to a tech/business audience. Return ONLY a JSON array, no markdown, no explanation. Format: [{"index": 1, "score": 8, "summary": "one sentence"}]`

function getCurrentDate(): string {
  const date = new Date();
  const year = date.getFullYear(); 
  const month = String(date.getMonth() + 1).padStart(2, '0'); 
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getProfession(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("Enter your profession: ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function scrapeToday() {
  let all_articles: { title: string; url: string; published_at: string }[] = [];
  let page = 1;

  while (true) {
    const url = `https://news.ycombinator.com/front?day=${getCurrentDate()}&p=${page}`;
    const articles = await scrape(url);
    if (articles.length === 0) break; // no more pages
    all_articles.push(...articles);
    page++;
  }

  return all_articles;
}

async function scrape(website: string) {
  console.log(`Scraping ${website}...`);
  const { data } = await axios.get(website);
  const $ = cheerio.load(data); // remove xmlMode

  const articles: { title: string; url: string; published_at: string }[] = [];

  $(".titleline > a").each((_, el) => {
    const title = $(el).text().trim();
    const url = $(el).attr("href") || "";
    if (title && url) articles.push({ title, url, published_at: getCurrentDate() });
  });

  console.log(`Found ${articles.length} articles`);
  return articles;
}


async function score(articles: { title: string; url: string; published_at: string}[], profession: string ){
  console.log("Scoring with Claude...");
  
  const BATCH_SIZE = 30;
  let allScores: { index: number; score: number; summary: string }[] = [];

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const titles = batch.map((a, j) => `${i + j + 1}. ${a.title}`).join("\n");

    console.log(`Scoring batch ${Math.floor(i / BATCH_SIZE) + 1}...`);

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `${prompt}\n
          Important: The user is a ${profession}. Prioritize articles relevant to their field. Deprioritize articles unrelated to their work.
          \n${titles}`,
        },
      ],
    });

    const raw = (message.content[0] as { text: string }).text;
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const scores = JSON.parse(cleaned);
    allScores.push(...scores);
  }

  return allScores;
}

async function save(
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
        published_at: new Date(article.published_at).toISOString(),
        importance_score: s.score,
        summary: s.summary,
      },
      { onConflict: "url" }
    );
    if (error) console.error("Insert error:", error.message);
  }
}

async function display() {
  const { data } = await supabase
    .from("articles")
    .select("*")
    .order("importance_score", { ascending: false })
    .limit(10);

  console.log("\nTop Articles:\n");
  data?.forEach((a) => {
    console.log(`[${a.importance_score}/10] ${a.title}`);
    console.log(`  → ${a.summary}`);
    console.log(`  ${a.url}\n`);
  });
}

async function main() {
  console.log("<< ASORT >>");
  console.log("Quickly find the most important articles for your profession!");
  console.log("please input your profession: ");
  console.log(getCurrentDate());

  const profession = await getProfession(); 
  const articles = await scrapeToday();
  const scores = await score(articles, profession);
  await save(articles, scores);
  await display();
}

main().catch(console.error);

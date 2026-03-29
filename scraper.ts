import axios from "axios";
import * as readline from "readline";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

let prompt = `Score each headline 1-100 for importance to the user based on their profession.
              A score of 100 means directly relevant and critical to their work.
              A score of 1 means completely irrelevant to their profession.
              General tech/business news should score LOW unless it directly impacts their field.
              Return ONLY a JSON array, no markdown, no explanation.
              Format: [{"index": 1, "score": 85, "summary": "one sentence"}]`

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
    rl.question("Enter your profession (be specific, e.g. 'cardiologist', 'software engineer at a fintech startup')\n", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function scrapeToday() {
  const { data: topIds } = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json');
  
  const top = topIds.slice(0, 120); // grab top 120
  const articles = await Promise.all(
    top.map(async (id: number) => {
      const { data: item } = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      return {
        title: item.title,
        url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        published_at: getCurrentDate(),
      };
    })
  );

  return articles.filter(a => a.url); // drop null urls
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
        published_at: article.published_at,
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

async function grabArticleText(url: string): Promise<string> {
  const { data } = await axios.get<string>(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ArticleScraper/1.0)',
    },
  });

  const $ = cheerio.load(data);
  $('script, style, nav, footer, header, aside, iframe, noscript').remove();

  const selectors = ['article', '[role="main"]', 'main', '.article-body', '.post-content', '.entry-content'];

  for (const selector of selectors) {
    const el = $(selector);
    if (el.length) return el.text().replace(/\s+/g, ' ').trim();
  }

  return $('p')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(t => t.length > 40) // skip short/empty paragraphs
    .join(' ');
}

async function summarizeArticleText(url: string): Promise<string> {
  const articleText = await grabArticleText(url);

  // check 1: too short
  if (articleText.length < 100) {
    throw new Error(`Article too short (${articleText.length} chars), likely paywalled`);
  }

  // check 2: paywall phrases in scraped text
  const paywallPhrases = [
    'subscribe to read', 'subscribe for full access', 'sign in to read',
    'create an account', 'buy a subscription', 'already a subscriber',
    'get full access', 'register to read', 'log in to read',
  ];
  if (paywallPhrases.some(p => articleText.toLowerCase().includes(p))) {
    throw new Error(`Paywall detected for ${url}`);
  }

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Summarize the following article in no more than 4 sentences. 
        Write in direct, declarative statements (e.g. "Researchers found..." or "A new tool was released..."). 
        Do not reference the author, article, or source. No headers, no markdown, plain text only.
        ${articleText}`,
      },
    ],
  });

  const rawSummary = (message.content[0] as { text: string }).text.trim();

  // check 3: Haiku admitted it couldn't summarize
  const failurePhrases = ['i cannot', "i can't", 'no article', 'not included', 'please provide'];
  if (failurePhrases.some(p => rawSummary.toLowerCase().includes(p))) {
    throw new Error(`Haiku couldn't summarize ${url}, likely paywalled`);
  }

  return rawSummary;
} 

async function summarizeArticles(n: number) {
  const { data } = await supabase
    .from("articles")
    .select("*")
    .order("importance_score", { ascending: false })
    .limit(n);

  if (!data) return;

  for (const a of data) {
    try {
      const summary = await summarizeArticleText(a.url);
      const { error } = await supabase.from("articles").update({ summary }).eq("id", a.id);
      if (error) console.error("Summary update error:", error.message);
    } catch (err: any) {
      console.warn(`Skipping ${a.url} (${err?.response?.status ?? err?.message}), keeping title-based summary.`);
    }
  }
}

async function main() {
  console.log("<<< ASORT >>>\n");
  console.log("Quickly find the most important articles for your profession!\n");

  const profession = await getProfession(); 
  console.log(); 

  const articles = await scrapeToday();
  const scores = await score(articles, profession);
  await save(articles, scores);
  await summarizeArticles(3); // summarize top 3 articles
  await display();
}

main().catch(console.error);

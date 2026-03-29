import axios from "axios";
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function grabArticleText(url: string): Promise<string> {
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
    .filter(t => t.length > 40)
    .join(' ');
}

export async function summarizeArticleText(url: string): Promise<string> {
  const articleText = await grabArticleText(url);

  if (articleText.length < 100) {
    throw new Error(`Article too short (${articleText.length} chars), likely paywalled`);
  }

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
                  If the text appears to be a paywall, login page, error page, or lacks real article content, return exactly: NULL
                  ${articleText}`,
      },
    ],
  });

  const rawSummary = (message.content[0] as { text: string }).text.trim();

  if (rawSummary.trim().toUpperCase() === 'NULL') {
    throw new Error(`Haiku returned NULL for ${url}, likely paywalled`);
  }

  const failurePhrases = ['i cannot', "i can't", 'no article', 'not included', 'please provide'];
  if (failurePhrases.some(p => rawSummary.toLowerCase().includes(p))) {
    throw new Error(`Haiku couldn't summarize ${url}, likely paywalled`);
  }

  return rawSummary;
}

export async function summarizeArticles(n: number) {
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

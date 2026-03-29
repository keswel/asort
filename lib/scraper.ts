import axios from "axios";
import * as cheerio from "cheerio";

function getCurrentDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function scrapeToday() {
  const { data: topIds } = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json');

  const top = topIds.slice(0, 120);
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

  return articles.filter(a => a.url);
}

export async function scrape(website: string) {
  console.log(`Scraping ${website}...`);
  const { data } = await axios.get(website);
  const $ = cheerio.load(data);

  const articles: { title: string; url: string; published_at: string }[] = [];

  $(".titleline > a").each((_, el) => {
    const title = $(el).text().trim();
    const url = $(el).attr("href") || "";
    if (title && url) articles.push({ title, url, published_at: getCurrentDate() });
  });

  console.log(`Found ${articles.length} articles`);
  return articles;
}

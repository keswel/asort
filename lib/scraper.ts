import axios from "axios";
import * as cheerio from "cheerio";

export async function scrape(from: string, to: string) {
  const fromTs = Math.floor(new Date(from).getTime() / 1000);
  const toTs = Math.floor(new Date(to).getTime() / 1000) + 86400;

  const { data } = await axios.get('https://hn.algolia.com/api/v1/search', {
    params: {
      tags: 'story',
      numericFilters: `created_at_i>${fromTs},created_at_i<${toTs}`,
      hitsPerPage: 500,
    }
  });

  return data.hits.map((item: any) => ({
    title: item.title,
    url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
    published_at: item.created_at,
    time: item.created_at_i * 1000,
  })).filter((a: any) => a.url);
}

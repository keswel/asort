import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const prompt = `Score each headline 1-100 for importance to the user based on their profession.
              A score of 100 means directly relevant and critical to their work.
              A score of 1 means completely irrelevant to their profession.
              General tech/business news should score LOW unless it directly impacts their field.
              Return ONLY a JSON array, no markdown, no explanation.
              Format: [{"index": 1, "score": 85, "summary": "one sentence"}]`;

export async function score(
  articles: { title: string; url: string; published_at: string }[],
  profession: string
) {
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

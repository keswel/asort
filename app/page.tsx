"use client";
import { useState } from "react";

type Article = {
  id: string;
  title: string;
  url: string;
  summary: string;
  importance_score: number;
};

export default function Home() {
  const [profession, setProfession] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    setLoading(true);
    try {
      const runRes = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profession }),
      });
      console.log("run status:", runRes.status);
      const runData = await runRes.json();
      console.log("run response:", runData);

      const res = await fetch("/api/articles");
      console.log("articles status:", res.status);
      const data = await res.json();
      console.log("articles:", data);
      setArticles(data);
    } catch (err) {
      console.error("error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>ASORT</h1>
      <input
        value={profession}
        onChange={e => setProfession(e.target.value)}
        placeholder="e.g. 'software engineer at a fintech startup'"
      />
      <button onClick={handleRun} disabled={loading}>
        {loading ? "Running..." : "Find Articles"}
      </button>

      {articles.map(a => (
        <div key={a.id}>
          <strong>[{a.importance_score}/100]</strong> {a.title}
          <p>{a.summary}</p>
          <a href={a.url} target="_blank" rel="noreferrer">Read →</a>
        </div>
      ))}
    </main>
  );
}

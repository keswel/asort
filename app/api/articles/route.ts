import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const { data } = await supabase
    .from("articles")
    .select("*")
    .gte("published_at", from)
    .lte("published_at", to)
    .order("importance_score", { ascending: false })
    .limit(10);

  return NextResponse.json(data ?? []);
}

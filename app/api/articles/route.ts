import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("articles")
    .select("*")
    .eq("published_at", today)
    .order("importance_score", { ascending: false })
    .limit(10);

  return NextResponse.json(data ?? []);
}

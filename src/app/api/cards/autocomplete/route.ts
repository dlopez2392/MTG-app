import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) return Response.json([]);

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("rules_embeddings")
    .select("title, metadata")
    .eq("source", "oracle_card")
    .ilike("title", `${q}%`)
    .order("title")
    .limit(10);

  if (error || !data) return Response.json([]);

  const suggestions = data.map((row) => {
    const meta = typeof row.metadata === "string"
      ? JSON.parse(row.metadata)
      : row.metadata;
    return {
      id: meta.oracle_id ?? row.title,
      name: row.title,
      imageUri: null,
      manaCost: meta.mana_cost ?? null,
      typeLine: meta.type_line ?? null,
    };
  });

  return Response.json(suggestions);
}

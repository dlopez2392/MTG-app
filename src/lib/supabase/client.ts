import { createClient, SupabaseClient } from "@supabase/supabase-js";

let instance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!instance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    instance = createClient(url, key, {
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });
  }
  return instance;
}

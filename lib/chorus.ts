import { getSupabase } from "./supabase";

export type Chorus = {
  id: string;
  slug: string;
  recipient_name: string;
  occasion: string;
  opens_at: string;
};

/**
 * Local-only stand-in so the contributor page can be built and clicked through
 * before a Supabase project exists. Only served when env vars are missing.
 */
export const DEMO_CHORUS: Chorus = {
  id: "00000000-0000-4000-8000-000000000000",
  slug: "demo",
  recipient_name: "Maya",
  occasion: "her 40th birthday",
  opens_at: "2026-11-02T13:00:00.000Z",
};

export async function getChorusBySlug(slug: string): Promise<Chorus | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return slug === DEMO_CHORUS.slug ? DEMO_CHORUS : null;
  }

  const { data, error } = await supabase
    .from("choruses")
    .select("id, slug, recipient_name, occasion, opens_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Could not load chorus "${slug}": ${error.message}`);
  return (data as Chorus | null) ?? null;
}

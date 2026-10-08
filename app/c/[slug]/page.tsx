import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Recorder } from "@/components/recorder";
import { getChorusBySlug } from "@/lib/chorus";

// Choruses are created by hand and links go out right away, so never cache.
export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/c/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const chorus = await getChorusBySlug(slug);
  if (!chorus) return { title: "Chorus" };
  return {
    title: `Say something to ${chorus.recipient_name}`,
    description: `A few words, in your own voice, for ${chorus.occasion}.`,
  };
}

export default async function ContributorPage(props: PageProps<"/c/[slug]">) {
  const { slug } = await props.params;
  const chorus = await getChorusBySlug(slug);
  if (!chorus) notFound();
  return <Recorder chorus={chorus} />;
}

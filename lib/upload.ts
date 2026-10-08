import { baseMime, buildStoragePath } from "./audio";
import { getSupabase } from "./supabase";

export type ClipSubmission = {
  chorusId: string;
  contributorName: string;
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
};

export class UploadError extends Error {
  constructor(message: string, readonly step: "storage" | "database") {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * Upload the audio to the private `clips` bucket, then record the row.
 * Runs in the browser with the anon key; RLS limits anon to inserts.
 */
export async function submitClip(clip: ClipSubmission): Promise<void> {
  const supabase = getSupabase();
  const contentType = baseMime(clip.mimeType) || "application/octet-stream";
  const storagePath = buildStoragePath(clip.chorusId, contentType, () =>
    crypto.randomUUID(),
  );

  if (!supabase) {
    // Demo mode: no Supabase yet. Pretend it took a moment and succeeded.
    await new Promise((r) => setTimeout(r, 900));
    console.info("[chorus demo] would upload", {
      storagePath,
      contentType,
      bytes: clip.blob.size,
      durationSeconds: clip.durationSeconds,
      contributorName: clip.contributorName,
    });
    return;
  }

  const { error: storageError } = await supabase.storage
    .from("clips")
    .upload(storagePath, clip.blob, { contentType, upsert: false });

  if (storageError) {
    throw new UploadError(storageError.message, "storage");
  }

  const { error: dbError } = await supabase.from("clips").insert({
    chorus_id: clip.chorusId,
    contributor_name: clip.contributorName,
    storage_path: storagePath,
    duration_seconds: Math.round(clip.durationSeconds * 100) / 100,
    mime_type: contentType,
  });

  if (dbError) {
    throw new UploadError(dbError.message, "database");
  }
}

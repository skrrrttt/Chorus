// Small pure helpers for recording and upload. No browser globals here so they
// stay testable; callers pass in `MediaRecorder.isTypeSupported` and the like.

/** Containers we try, in order. iOS Safari only does audio/mp4; Chrome prefers webm. */
const MIME_CANDIDATES = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

export function pickRecordingMime(
  isSupported: (mime: string) => boolean,
): string | undefined {
  return MIME_CANDIDATES.find((m) => {
    try {
      return isSupported(m);
    } catch {
      return false;
    }
  });
}

const EXTENSIONS: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/3gpp": "3gp",
};

export function extensionForMime(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  return EXTENSIONS[base] ?? "bin";
}

/** Strip codec parameters so the stored type matches the bucket's allow-list. */
export function baseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

export function buildStoragePath(
  chorusId: string,
  mime: string,
  makeId: () => string,
): string {
  return `${chorusId}/${makeId()}.${extensionForMime(mime)}`;
}

export const MAX_NAME_LENGTH = 40;

export function cleanFirstName(raw: string): string {
  const first = raw.trim().split(/\s+/)[0] ?? "";
  return first.slice(0, MAX_NAME_LENGTH);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function formatOpensAt(
  iso: string,
  locale?: string,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(new Date(iso));
}

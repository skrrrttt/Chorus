// A recording session that never leaves the caller hanging.
//
// iOS Safari sometimes never fires MediaRecorder's `stop` event after
// `stop()` is called. If the UI waits for that event, the contributor is
// stuck on the recording screen with no way out. So: ask for chunks as we go,
// and if the browser goes quiet after stop, cut the mic tracks (which forces
// the recorder to wind down) and resolve with whatever audio we have.

/** Lets a real MediaRecorder (whose handlers take full DOM events) satisfy the shape. */
type Handler<E> = { bivarianceHack(ev: E): void }["bivarianceHack"];

export type RecorderLike = {
  readonly state: "inactive" | "recording" | "paused";
  readonly mimeType: string;
  start(timeslice?: number): void;
  stop(): void;
  requestData?: () => void;
  ondataavailable: Handler<{ data: Blob }> | null;
  onstop: Handler<unknown> | null;
  onerror: Handler<unknown> | null;
};

export type TrackLike = { stop(): void };

export type RecordingResult = {
  blob: Blob;
  mime: string;
  seconds: number;
  /** False when the browser never confirmed the stop and we gave up waiting. */
  clean: boolean;
};

export type RecordingSession = {
  stop(): Promise<RecordingResult>;
};

/** How often the browser hands us audio while recording. */
export const TIMESLICE_MS = 1000;
/** How long to wait for the browser's stop event before giving up on it. */
export const STOP_TIMEOUT_MS = 1500;

export function startRecording(
  rec: RecorderLike,
  tracks: TrackLike[],
  fallbackMime = "audio/mp4",
): RecordingSession {
  const chunks: Blob[] = [];
  const startedAt = Date.now();
  let stopping: Promise<RecordingResult> | null = null;
  let stoppedAt = 0;

  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  rec.start(TIMESLICE_MS);

  const build = (clean: boolean): RecordingResult => {
    const mime = rec.mimeType || chunks[0]?.type || fallbackMime;
    return {
      blob: new Blob(chunks, { type: mime }),
      mime,
      seconds: (stoppedAt - startedAt) / 1000,
      clean,
    };
  };

  return {
    stop() {
      if (stopping) return stopping;
      stoppedAt = Date.now();
      stopping = new Promise<RecordingResult>((resolve) => {
        let settled = false;
        const settle = (clean: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(build(clean));
        };

        const timer = setTimeout(() => {
          // The browser went quiet. Ending the tracks makes a well-behaved
          // recorder finish; a wedged one at least lets go of the mic.
          for (const t of tracks) t.stop();
          settle(false);
        }, STOP_TIMEOUT_MS);

        rec.onstop = () => settle(true);
        rec.onerror = () => settle(false);
        if (rec.state !== "inactive") {
          try {
            rec.requestData?.();
          } catch {
            // Not every browser allows this; the final chunk still arrives on stop.
          }
          rec.stop();
        } else {
          // Already inactive, so no stop event is coming.
          settle(false);
        }
      });
      return stopping;
    },
  };
}

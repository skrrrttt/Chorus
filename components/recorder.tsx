"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  cleanFirstName,
  formatClock,
  formatOpensAt,
  MAX_NAME_LENGTH,
  pickRecordingMime,
} from "@/lib/audio";
import type { Chorus } from "@/lib/chorus";
import { startRecording as startSession, type RecordingSession } from "@/lib/recording";
import { submitClip } from "@/lib/upload";

const MAX_SECONDS = 120;
const MIN_SECONDS = 1;

const PROMPTS = [
  "One memory.",
  "What they mean to you.",
  "One wish for the year ahead.",
];

type Phase =
  | "idle"
  | "arming"
  | "recording"
  | "stopping"
  | "review"
  | "uploading"
  | "done"
  | "mic-denied";

export function Recorder({ chorus }: { chorus: Chorus }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<{
    blob: Blob;
    url: string;
    mime: string;
    seconds: number;
  } | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<RecordingSession | null>(null);
  const holdingRef = useRef(false);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>("idle");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Browser-only feature check. The server assumes support so the first paint
  // matches; the client corrects it before anything is interactive.
  const supported = useSyncExternalStore(
    subscribeNoop,
    canRecordHere,
    () => true,
  );

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Tidy up on unmount.
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      releaseMic();
    };
  }, [releaseMic]);

  useEffect(() => {
    const url = clip?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [clip]);

  // Leaves the recording screen right away, then waits for the audio. The
  // session resolves even if the browser never confirms the stop, which iOS
  // Safari sometimes fails to do.
  const stopRecording = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || phaseRef.current !== "recording") return;
    sessionRef.current = null;
    phaseRef.current = "stopping";
    setPhase("stopping");
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;

    const { blob, mime, seconds, clean } = await session.stop();
    if (!clean) {
      // The tracks were cut to unstick the recorder; start fresh next time.
      releaseMic();
    }

    if (seconds < MIN_SECONDS || blob.size === 0) {
      setHint(
        clean
          ? "That was quick. Hold the button while you talk, then let go."
          : "We didn't catch that. Hold the button and try again.",
      );
      setPhase("idle");
      return;
    }

    setClip({ blob, url: URL.createObjectURL(blob), mime, seconds });
    setHint(null);
    setPhase("review");
  }, [releaseMic]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    const mime = pickRecordingMime((m) => MediaRecorder.isTypeSupported(m));
    let rec: MediaRecorder;
    try {
      rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
    } catch {
      rec = new MediaRecorder(stream);
    }

    startedAtRef.current = Date.now();
    setElapsed(0);
    setHint(null);
    phaseRef.current = "recording";
    setPhase("recording");
    sessionRef.current = startSession(
      rec,
      stream.getTracks(),
      mime ?? "audio/webm",
    );

    tickRef.current = setInterval(() => {
      const s = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(s);
      if (s >= MAX_SECONDS) void stopRecording();
    }, 200);
  }, [stopRecording]);

  const beginHold = useCallback(async () => {
    holdingRef.current = true;

    // A tap while recording stops it. Covers the case where the release event
    // never arrived (a permission sheet or a phone call got in the way).
    if (phaseRef.current === "recording") {
      void stopRecording();
      holdingRef.current = false;
      return;
    }
    if (phaseRef.current !== "idle") return;

    if (streamRef.current) {
      startRecording();
      return;
    }

    setPhase("arming");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (holdingRef.current) {
        startRecording();
      } else {
        setHint("Your microphone is on. Now hold the button and talk.");
        setPhase("idle");
      }
    } catch {
      holdingRef.current = false;
      setPhase("mic-denied");
    }
  }, [startRecording, stopRecording]);

  const endHold = useCallback(() => {
    holdingRef.current = false;
    if (phaseRef.current === "recording") void stopRecording();
  }, [stopRecording]);

  // If the page goes away mid-recording (call, lock screen), stop cleanly.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") endHold();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", endHold);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", endHold);
    };
  }, [endHold]);

  const recordAgain = useCallback(() => {
    setClip(null);
    setError(null);
    setHint(null);
    setPhase("idle");
  }, []);

  const cleanName = cleanFirstName(name);
  const nameMissing = cleanName.length === 0;

  const send = useCallback(async () => {
    if (!clip) return;
    setNameTouched(true);
    if (nameMissing) return;

    setError(null);
    setPhase("uploading");
    try {
      await submitClip({
        chorusId: chorus.id,
        contributorName: cleanName,
        blob: clip.blob,
        mimeType: clip.mime,
        durationSeconds: clip.seconds,
      });
      releaseMic();
      setPhase("done");
    } catch (e) {
      console.error(e);
      setError("That didn't go through. Check your connection and try again.");
      setPhase("review");
    }
  }, [chorus.id, cleanName, clip, nameMissing, releaseMic]);

  // ---- Screens -------------------------------------------------------------

  if (!supported) {
    return (
      <Shell chorus={chorus}>
        <p className="text-ink-secondary text-[17px] leading-relaxed">
          This browser can&rsquo;t record audio. Try opening the link in Safari
          on an iPhone, or Chrome on Android. If that doesn&rsquo;t work, send
          a voice memo to whoever shared this link and they&rsquo;ll add it for you.
        </p>
      </Shell>
    );
  }

  if (phase === "mic-denied") {
    return (
      <Shell chorus={chorus}>
        <p className="text-ink-secondary text-[17px] leading-relaxed">
          We need the microphone to hear you. Allow it in your browser
          settings, then reload this page.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-8 h-14 w-full rounded-full bg-accent text-on-accent text-[17px] font-semibold"
        >
          Reload
        </button>
      </Shell>
    );
  }

  if (phase === "done") {
    return (
      <Shell chorus={chorus} heading={`Thank you, ${cleanName}.`}>
        <p className="text-ink-secondary text-[17px] leading-relaxed">
          Your voice is in. {chorus.recipient_name} hears it on{" "}
          {formatOpensAt(chorus.opens_at)}, along with everyone else&rsquo;s.
          Nothing else to do.
        </p>
      </Shell>
    );
  }

  if (phase === "review" || phase === "uploading") {
    const busy = phase === "uploading";
    return (
      <Shell chorus={chorus} heading="Here's what you said.">
        {clip && (
          <Playback key={clip.url} url={clip.url} seconds={clip.seconds} />
        )}

        <label className="mt-10 block">
          <span className="text-ink-muted text-[15px]">Your first name</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="done"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            disabled={busy}
            aria-invalid={nameTouched && nameMissing}
            className="mt-2 h-14 w-full rounded-2xl border border-line-strong bg-surface px-4 text-[20px] text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none"
            placeholder="So they know it's you"
          />
          {nameTouched && nameMissing && (
            <span className="mt-2 block text-[15px] text-accent">
              Add your first name so {chorus.recipient_name} knows who this is.
            </span>
          )}
        </label>

        {error && (
          <p role="alert" className="mt-6 text-[15px] text-accent">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="mt-8 h-14 w-full rounded-full bg-accent text-on-accent text-[17px] font-semibold disabled:opacity-70"
        >
          {busy ? "Sending…" : `Send to ${chorus.recipient_name}`}
        </button>
        <button
          type="button"
          onClick={recordAgain}
          disabled={busy}
          className="mt-3 h-12 w-full rounded-full text-ink-secondary text-[16px] disabled:opacity-50"
        >
          Record again
        </button>
      </Shell>
    );
  }

  // idle / arming / recording / stopping
  const recording = phase === "recording";
  const arming = phase === "arming";
  const stopping = phase === "stopping";

  return (
    <Shell chorus={chorus} intro>
      <section aria-label="If you freeze" className="mt-7">
        <p className="text-ink-muted text-[13px] uppercase tracking-[0.12em]">
          If you freeze
        </p>
        <ul className="mt-2 space-y-1">
          {PROMPTS.map((p) => (
            <li key={p} className="flex gap-3 text-[16px] text-ink-secondary">
              <span aria-hidden className="text-accent">
                &ndash;
              </span>
              {p}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-auto flex flex-col items-center pt-8">
        <p
          className="h-7 font-display text-[26px] text-ink tabular-nums"
          aria-live="polite"
        >
          {recording ? formatClock(elapsed) : ""}
        </p>

        <div className="relative mt-4 h-[132px] w-[132px]">
          {recording && (
            <span
              aria-hidden
              className="pulse-ring absolute inset-0 rounded-full bg-record"
            />
          )}
          <button
            type="button"
            aria-label={recording ? "Recording. Let go to stop." : "Hold to record"}
            aria-pressed={recording}
            disabled={arming || stopping}
            className={[
              "hold-target relative flex h-[132px] w-[132px] items-center justify-center rounded-full",
              "transition-transform duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50",
              recording
                ? "scale-95 bg-record text-ink"
                : "bg-accent text-on-accent active:scale-95",
              arming || stopping ? "opacity-70" : "",
            ].join(" ")}
            onPointerDown={(e) => {
              e.preventDefault();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // Some browsers refuse capture for synthetic or stale pointers.
              }
              void beginHold();
            }}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                e.preventDefault();
                void beginHold();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === " " || e.key === "Enter") endHold();
            }}
          >
            <MicGlyph recording={recording} />
          </button>
        </div>

        <p className="mt-6 min-h-[3.25rem] text-center text-[17px] leading-snug text-ink-secondary">
          {recording
            ? "Let go when you're done."
            : stopping
              ? "One moment…"
              : arming
                ? "Turning on the microphone…"
                : hint ?? "Hold the button and talk. Let go when you're done."}
        </p>
      </div>
    </Shell>
  );
}

// ---- Pieces ----------------------------------------------------------------

function subscribeNoop() {
  return () => {};
}

function canRecordHere(): boolean {
  return (
    typeof window !== "undefined" &&
    "MediaRecorder" in window &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

function Shell({
  chorus,
  heading,
  intro,
  children,
}: {
  chorus: Chorus;
  heading?: string;
  intro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[390px] flex-1 flex-col px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]">
      <p className="text-ink-muted text-[14px] tracking-[0.08em]">Chorus</p>
      <h1 className="mt-6 font-display text-[40px] leading-[1.08] text-ink">
        {heading ?? (
          <>
            Say something to {chorus.recipient_name}
            <span className="block text-ink-secondary italic">
              for {chorus.occasion}.
            </span>
          </>
        )}
      </h1>
      {intro && (
        <p className="mt-5 text-[17px] leading-relaxed text-ink-secondary">
          A few words, in your own voice. {chorus.recipient_name} hears it on{" "}
          {formatOpensAt(chorus.opens_at)}.
        </p>
      )}
      <div className="mt-2 flex flex-1 flex-col">{children}</div>
    </main>
  );
}

function Playback({ url, seconds }: { url: string; seconds: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  };

  const shown = playing || position > 0 ? position : seconds;

  return (
    <div className="mt-8 flex items-center gap-4 rounded-3xl border border-line bg-surface p-4">
      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Listen back"}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent"
      >
        {playing ? (
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
            <rect x="4" y="3" width="4" height="14" rx="1" fill="currentColor" />
            <rect x="12" y="3" width="4" height="14" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
            <path d="M6 3.5v13l11-6.5-11-6.5z" fill="currentColor" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] text-ink">
          {playing ? "Playing" : "Listen back"}
        </p>
        <p className="text-[15px] text-ink-muted tabular-nums">
          {formatClock(shown)}
        </p>
      </div>
    </div>
  );
}

function MicGlyph({ recording }: { recording: boolean }) {
  if (recording) {
    return (
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
        <rect x="10" y="10" width="20" height="20" rx="4" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 44 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="16" y="6" width="12" height="20" rx="6" />
      <path d="M10 22a12 12 0 0 0 24 0" />
      <path d="M22 34v5" />
      <path d="M15 39h14" />
    </svg>
  );
}

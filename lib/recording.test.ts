import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  startRecording,
  STOP_TIMEOUT_MS,
  TIMESLICE_MS,
  type RecorderLike,
} from "./recording";

/** A MediaRecorder stand-in whose stop callbacks we control from the test. */
class FakeRecorder implements RecorderLike {
  state: "inactive" | "recording" | "paused" = "inactive";
  mimeType = "audio/mp4";
  ondataavailable: ((ev: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  startCalls: Array<number | undefined> = [];
  stopCalls = 0;

  start(timeslice?: number) {
    this.state = "recording";
    this.startCalls.push(timeslice);
  }
  stop() {
    this.state = "inactive";
    this.stopCalls += 1;
  }
  /** What a healthy browser does: deliver the data, then fire stop. */
  finish(bytes: string) {
    this.ondataavailable?.({ data: new Blob([bytes], { type: this.mimeType }) });
    this.onstop?.();
  }
  /** A timeslice chunk arriving mid-recording. */
  chunk(bytes: string) {
    this.ondataavailable?.({ data: new Blob([bytes], { type: this.mimeType }) });
  }
}

function fakeTracks() {
  const stopped: number[] = [];
  const tracks = [0, 1].map((i) => ({ stop: () => stopped.push(i) }));
  return { tracks, stopped };
}

describe("startRecording", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the browser for chunks as it goes so a stuck stop still has audio", () => {
    const rec = new FakeRecorder();
    startRecording(rec, fakeTracks().tracks);
    expect(rec.startCalls).toEqual([TIMESLICE_MS]);
  });

  it("resolves with the clip when the browser fires stop normally", async () => {
    const rec = new FakeRecorder();
    const { tracks, stopped } = fakeTracks();
    const session = startRecording(rec, tracks);

    vi.advanceTimersByTime(2500);
    const pending = session.stop();
    expect(rec.stopCalls).toBe(1);
    rec.finish("abcdef");

    const result = await pending;
    expect(result.clean).toBe(true);
    expect(result.blob.size).toBe(6);
    expect(result.mime).toBe("audio/mp4");
    expect(result.seconds).toBeCloseTo(2.5, 1);
    // A clean stop leaves the mic alone so "record again" is instant.
    expect(stopped).toEqual([]);
  });

  it("still resolves when the browser never fires stop (iOS Safari)", async () => {
    const rec = new FakeRecorder();
    const { tracks, stopped } = fakeTracks();
    const session = startRecording(rec, tracks);

    vi.advanceTimersByTime(3000);
    rec.chunk("1234");
    const pending = session.stop();
    // Nothing comes back from the recorder. Ever.
    vi.advanceTimersByTime(STOP_TIMEOUT_MS + 1);

    const result = await pending;
    expect(result.clean).toBe(false);
    expect(result.blob.size).toBe(4);
    expect(result.seconds).toBeCloseTo(3, 1);
    // The wedged recorder is cut off at the source so the mic light goes out.
    expect(stopped).toEqual([0, 1]);
  });

  it("returns the same promise if stop is asked for twice", () => {
    const rec = new FakeRecorder();
    const session = startRecording(rec, fakeTracks().tracks);
    const a = session.stop();
    const b = session.stop();
    expect(a).toBe(b);
    expect(rec.stopCalls).toBe(1);
  });

  it("reports an empty clip when a stuck recorder produced no data", async () => {
    const rec = new FakeRecorder();
    const session = startRecording(rec, fakeTracks().tracks);
    const pending = session.stop();
    vi.advanceTimersByTime(STOP_TIMEOUT_MS + 1);
    const result = await pending;
    expect(result.clean).toBe(false);
    expect(result.blob.size).toBe(0);
  });
});

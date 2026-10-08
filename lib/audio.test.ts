import { describe, expect, it } from "vitest";
import {
  buildStoragePath,
  cleanFirstName,
  extensionForMime,
  formatClock,
  formatOpensAt,
  pickRecordingMime,
} from "./audio";

describe("pickRecordingMime", () => {
  it("prefers audio/mp4 when the device supports it (iOS Safari)", () => {
    const supported = (m: string) => m === "audio/mp4";
    expect(pickRecordingMime(supported)).toBe("audio/mp4");
  });

  it("falls back to webm opus on Chrome", () => {
    const supported = (m: string) => m.startsWith("audio/webm");
    expect(pickRecordingMime(supported)).toBe("audio/webm;codecs=opus");
  });

  it("returns undefined when nothing matches so the browser picks", () => {
    expect(pickRecordingMime(() => false)).toBeUndefined();
  });
});

describe("extensionForMime", () => {
  it("maps common containers, ignoring codec parameters", () => {
    expect(extensionForMime("audio/mp4")).toBe("m4a");
    expect(extensionForMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionForMime("audio/ogg; codecs=opus")).toBe("ogg");
    expect(extensionForMime("audio/mpeg")).toBe("mp3");
  });

  it("uses a safe default for unknown or empty types", () => {
    expect(extensionForMime("")).toBe("bin");
    expect(extensionForMime("video/quicktime")).toBe("bin");
  });
});

describe("buildStoragePath", () => {
  it("nests the file under the chorus id", () => {
    const path = buildStoragePath("abc-123", "audio/mp4", () => "clip-id");
    expect(path).toBe("abc-123/clip-id.m4a");
  });
});

describe("cleanFirstName", () => {
  it("trims, collapses whitespace, and keeps the first word", () => {
    expect(cleanFirstName("  Maya   Rose ")).toBe("Maya");
  });

  it("returns an empty string for blank input", () => {
    expect(cleanFirstName("   ")).toBe("");
  });

  it("caps very long names", () => {
    expect(cleanFirstName("a".repeat(80))).toHaveLength(40);
  });
});

describe("formatClock", () => {
  it("renders m:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(7.4)).toBe("0:07");
    expect(formatClock(65)).toBe("1:05");
  });
});

describe("formatOpensAt", () => {
  it("renders a warm date without the time", () => {
    const out = formatOpensAt("2026-11-02T13:00:00.000Z", "en-US", "UTC");
    expect(out).toBe("Monday, November 2");
  });
});

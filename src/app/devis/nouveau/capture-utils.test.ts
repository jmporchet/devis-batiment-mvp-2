import { describe, expect, it } from "vitest";
import {
  audioExtension,
  detectMicIssue,
  formatTimer,
  micIssueFromError,
  pickAudioMimeType,
  scaledDimensions,
} from "./capture-utils";

describe("pickAudioMimeType", () => {
  it("préfère webm/opus", () => {
    expect(pickAudioMimeType(() => true)).toBe("audio/webm;codecs=opus");
  });
  it("retombe sur audio/mp4 (Safari)", () => {
    expect(pickAudioMimeType((m) => m === "audio/mp4")).toBe("audio/mp4");
  });
  it("retourne undefined si rien n'est supporté", () => {
    expect(pickAudioMimeType(() => false)).toBeUndefined();
  });
});

describe("audioExtension", () => {
  it("ignore les paramètres du type", () => {
    expect(audioExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(audioExtension("audio/mp4")).toBe("m4a");
    expect(audioExtension("audio/ogg")).toBe("ogg");
  });
});

describe("scaledDimensions", () => {
  it("ne touche pas une image déjà petite", () => {
    expect(scaledDimensions(1600, 1200)).toEqual({ width: 1600, height: 1200 });
  });
  it("réduit le côté long à 2000 en paysage", () => {
    expect(scaledDimensions(4000, 3000)).toEqual({ width: 2000, height: 1500 });
  });
  it("réduit le côté long à 2000 en portrait", () => {
    expect(scaledDimensions(3024, 4032)).toEqual({ width: 1500, height: 2000 });
  });
  it("garde au moins 1 pixel", () => {
    expect(scaledDimensions(100000, 10)).toEqual({ width: 2000, height: 1 });
  });
});

describe("formatTimer", () => {
  it("formate m:ss", () => {
    expect(formatTimer(0)).toBe("0:00");
    expect(formatTimer(7.9)).toBe("0:07");
    expect(formatTimer(60)).toBe("1:00");
  });
});

describe("detectMicIssue", () => {
  const ok = { isSecureContext: true, hasMediaDevices: true, hasMediaRecorder: true };
  it("signale le contexte non sécurisé en premier", () => {
    expect(detectMicIssue({ ...ok, isSecureContext: false, hasMediaDevices: false })).toBe("insecure");
  });
  it("signale l'absence de MediaRecorder ou de mediaDevices", () => {
    expect(detectMicIssue({ ...ok, hasMediaRecorder: false })).toBe("no-recorder");
    expect(detectMicIssue({ ...ok, hasMediaDevices: false })).toBe("no-recorder");
  });
  it("accepte un environnement complet", () => {
    expect(detectMicIssue(ok)).toBeNull();
  });
});

describe("micIssueFromError", () => {
  it("distingue refus et absence de micro", () => {
    expect(micIssueFromError(new DOMException("x", "NotAllowedError"))).toBe("denied");
    expect(micIssueFromError(new DOMException("x", "NotFoundError"))).toBe("no-device");
  });
});

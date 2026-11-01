import { describe, it, expect } from "vitest";
import { cleanTitle, isAudioFile, makeTrack } from "./tracks";

describe("track metadata", () => {
  it("strips number prefix and extension", () => {
    expect(cleanTitle("01 - Midnight Drive.mp3")).toBe("Midnight Drive");
  });
  it("accepts the six formats only", () => {
    for (const e of ["mp3", "wav", "flac", "m4a", "aac", "ogg"]) expect(isAudioFile(`a.${e}`)).toBe(true);
    expect(isAudioFile("cover.jpg")).toBe(false);
  });
  it("artist and album are always ME", () => {
    const t = makeTrack("x", "Song.flac", "u");
    expect([t.artist, t.album]).toEqual(["ME", "ME"]);
  });
});

export const AUDIO_EXTENSIONS = ["mp3", "wav", "flac", "m4a", "aac", "ogg"] as const;
export const ANON = "ME";

export type Track = { id: string; title: string; src: string; artist: string; album: string };

export function isAudioFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return (AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}

/** "01 - My_Song.mp3" -> "My Song" */
export function cleanTitle(fileName: string): string {
  let t = fileName.replace(/\.(mp3|wav|flac|m4a|aac|ogg)$/i, "");
  t = t.replace(/^\s*(track\s*)?\d{1,3}\s*[-._)\]]*\s*/i, "");
  t = t.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return t || fileName;
}

export function driveStreamUrl(id: string) {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
}

export function makeTrack(id: string, fileName: string, src: string): Track {
  return { id, title: cleanTitle(fileName), src, artist: ANON, album: ANON };
}

export const DEMO_TRACKS: Track[] = Array.from({ length: 8 }, (_, i) =>
  makeTrack(
    `demo-${i + 1}`,
    `${String(i + 1).padStart(2, "0")} - Demo Track ${i + 1}.mp3`,
    `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${i + 1}.mp3`,
  ),
);

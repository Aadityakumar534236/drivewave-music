import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Disc3, Search, Library, ListMusic, Settings, Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Repeat1, Volume2, VolumeX, X, Lock, Sparkles, Loader2, Wand2, ChevronLeft,
} from "lucide-react";
import { DEMO_TRACKS, driveStreamUrl, isAudioFile, makeTrack, type Track } from "@/lib/tracks";
import { listDriveFolder } from "@/lib/drive.functions";
import { recommendQueue } from "@/lib/mood.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ME Music — Ads-free AI DJ" },
      { name: "description", content: "Stream songs from Google Drive, ads-free, with an AI DJ that follows your mood." },
      { property: "og:title", content: "ME Music — Ads-free AI DJ" },
      { property: "og:description", content: "Stream songs from Google Drive, ads-free, with an AI DJ that follows your mood." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Player,
});

const STORAGE_KEY = "drive-folder-id";
type View = "home" | "search" | "library" | "playlists";
type PlaylistId = "dj" | "all" | "az";
const fmt = (s: number) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

function Cover({ seed, className, spinning }: { seed: string; className?: string; spinning?: boolean }) {
  const h = [...seed].reduce((a, c, i) => a + c.charCodeAt(0) * (i + 7), 0) % 360;
  return (
    <div className={cn("vinyl relative flex items-center justify-center shadow-lg", spinning && "animate-vinyl", className)}>
      <div className="h-[38%] w-[38%] rounded-full border-2 border-background"
        style={{ background: `conic-gradient(from ${h}deg, oklch(0.75 0.15 ${h}), oklch(0.6 0.12 ${(h + 90) % 360}), oklch(0.75 0.15 ${h}))` }} />
      <div className="absolute h-[6%] w-[6%] rounded-full bg-background" />
    </div>
  );
}

function Player() {
  const [folderId, setFolderId] = useState("");
  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS);
  const [status, setStatus] = useState("Demo tracks");
  const [view, setView] = useState<View>("home");
  const [openList, setOpenList] = useState<PlaylistId | null>(null);
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const audio = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off");

  // AI DJ
  const [autoDj, setAutoDj] = useState(true);
  const [queue, setQueue] = useState<number[]>([]);
  const [djNote, setDjNote] = useState("");
  const [djErr, setDjErr] = useState("");
  const [djBusy, setDjBusy] = useState(false);
  const [mood, setMood] = useState("");
  const recommend = useServerFn(recommendQueue);
  const djRequest = useRef(0);

  const load = useCallback(async (id: string) => {
    setQueue([]); setDjNote("");
    if (!id) { setTracks(DEMO_TRACKS); setStatus("Demo tracks"); return; }
    setStatus("Syncing Google Drive…");
    try {
      const files = await listDriveFolder({ data: { folderId: id } });
      const list = files.filter((f) => isAudioFile(f.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map((f) => makeTrack(f.id, f.name, driveStreamUrl(f.id)));
      if (!list.length) { setTracks(DEMO_TRACKS); setStatus("No audio in folder — demo tracks"); return; }
      setTracks(list); setCurrent(-1); setStatus(`${list.length} songs from Drive`);
    } catch {
      setTracks(DEMO_TRACKS); setStatus("Couldn't read folder — demo tracks");
    }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY) ?? "";
    setFolderId(id); void load(id);
  }, [load]);

  useEffect(() => { if (audio.current) audio.current.volume = muted ? 0 : volume; }, [volume, muted]);

  const track = current >= 0 ? tracks[current] : null;

  const start = (i: number) => {
    const a = audio.current; const t = tracks[i]; if (!a || !t) return;
    setCurrent(i); a.src = t.src; a.play().catch(() => {});
  };

  const askDj = async (prompt: string, seed?: number) => {
    const req = ++djRequest.current;
    setDjBusy(true); setDjErr("");
    try {
      const r = await recommend({ data: { mood: prompt, titles: tracks.map((t) => t.title) } });
      if (req !== djRequest.current) return;
      if ("error" in r) { setDjErr(r.error); return; }
      const rest = r.indices.filter((n) => n !== seed);
      const q = seed !== undefined ? [seed, ...rest] : rest;
      setQueue(q); setDjNote(r.note);
      if (seed === undefined && q[0] !== undefined) start(q[0]);
    } catch { if (req === djRequest.current) setDjErr("The AI DJ couldn't build a queue. Try again."); }
    finally { if (req === djRequest.current) setDjBusy(false); }
  };

  /** User picked a song by hand: play it, and let the AI DJ queue songs with the same feel. */
  const pick = (i: number) => {
    const a = audio.current; if (!a) return;
    if (i === current) { a.paused ? a.play() : a.pause(); return; }
    start(i);
    if (autoDj && tracks.length > 1) {
      const title = tracks[i]!.title;
      setQueue([i]); setDjNote(`Reading the mood of "${title}"…`);
      void askDj(`Detect the mood, theme and vibe of the song titled "${title}" and pick songs that feel related to it. Put the most similar first.`, i);
    }
  };

  const next = (auto = false) => {
    const a = audio.current; if (!a || !tracks.length) return;
    if (auto && repeat === "one") { a.currentTime = 0; a.play(); return; }
    if (queue.length > 1) {
      let q = queue.indexOf(current) + 1;
      if (q >= queue.length) { if (auto && repeat === "off") return; q = 0; }
      start(queue[q]!); return;
    }
    let i = shuffle ? Math.floor(Math.random() * tracks.length) : current + 1;
    if (i >= tracks.length) { if (auto && repeat === "off") return; i = 0; }
    start(i);
  };
  const prev = () => {
    const a = audio.current; if (!a) return;
    if (a.currentTime > 3 || current < 0) { a.currentTime = 0; return; }
    const q = queue.indexOf(current);
    if (queue.length > 1 && q > 0) start(queue[q - 1]!);
    else if (current > 0) start(current - 1);
    else a.currentTime = 0;
  };
  const toggle = () => { if (current < 0) pick(0); else pick(current); };

  const all = useMemo(() => tracks.map((t, i) => ({ t, i })), [tracks]);
  const filtered = useMemo(() => all.filter(({ t }) => t.title.toLowerCase().includes(query.toLowerCase())), [all, query]);
  const queued = queue.map((i) => ({ t: tracks[i]!, i })).filter((x) => x.t);
  const az = useMemo(() => [...all].sort((a, b) => a.t.title.localeCompare(b.t.title)), [all]);

  const tabs: { id: View; label: string; icon: typeof Disc3 }[] = [
    { id: "home", label: "Listen", icon: Disc3 },
    { id: "search", label: "Search", icon: Search },
    { id: "library", label: "Library", icon: Library },
    { id: "playlists", label: "Playlists", icon: ListMusic },
  ];
  const go = (v: View) => { setView(v); setOpenList(null); };

  const List = ({ items, empty }: { items: { t: Track; i: number }[]; empty?: string }) => (
    <ol className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card/60">
      {items.map(({ t, i }, n) => (
        <li key={`${t.id}-${n}`}>
          <button onClick={() => pick(i)}
            className={cn("flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent", current === i && "bg-accent")}>
            <span className="w-6 text-right font-display text-lg text-muted-foreground">{n + 1}</span>
            <Cover seed={t.title} spinning={current === i && playing} className="h-11 w-11 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate font-semibold", current === i && "text-primary")}>{t.title}</span>
              <span className="block text-xs text-muted-foreground">Artist {t.artist} · Album {t.album}</span>
            </span>
            {current === i && playing ? <Pause className="h-4 w-4 text-primary" /> : <Play className="h-4 w-4 text-muted-foreground" />}
          </button>
        </li>
      ))}
      {!items.length && <li className="p-10 text-center text-muted-foreground">{empty ?? "Nothing here yet."}</li>}
    </ol>
  );

  const playlists: { id: PlaylistId; name: string; desc: string; items: { t: Track; i: number }[] }[] = [
    { id: "dj", name: "AI DJ queue", desc: queued.length ? `${queued.length} songs picked by AI` : "Play any song to start one", items: queued },
    { id: "all", name: "Everything by ME", desc: `${tracks.length} songs`, items: all },
    { id: "az", name: "A to Z", desc: "Every song, alphabetical", items: az },
  ];

  return (
    <div className="bg-hero min-h-screen bg-background pb-40 text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <span className="flex items-center gap-2 font-display text-2xl italic"><Disc3 className="h-6 w-6 text-primary" /> ME Music</span>
          <nav className="ml-auto flex gap-1 rounded-full bg-card p-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => go(t.id)} aria-current={view === t.id ? "page" : undefined}
                className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:px-4",
                  view === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                <t.icon className="h-4 w-4" /><span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </nav>
          <button onClick={() => setSettingsOpen(true)} aria-label="Drive settings" className="rounded-full bg-card p-2 hover:bg-accent"><Settings className="h-4 w-4" /></button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-8">
        {view === "home" && (
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
            <section className="flex flex-col items-center rounded-3xl border border-border bg-card/60 p-8 text-center">
              <Cover seed={track?.title ?? "idle"} spinning={playing} className="h-56 w-56 sm:h-64 sm:w-64" />
              <p className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">{playing ? "Now spinning" : "Ready"}</p>
              <h1 className="mt-1 font-display text-4xl">{track?.title ?? "Pick a record"}</h1>
              <p className="text-sm text-muted-foreground">ME · ME</p>
              <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-full bg-secondary px-4 py-2 text-sm">
                <input type="checkbox" checked={autoDj} onChange={(e) => setAutoDj(e.target.checked)} className="accent-primary" />
                <Wand2 className="h-4 w-4 text-primary" /> AI DJ follows the song you play
              </label>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Free & ads-free · library managed by the owner · {status}</p>
            </section>

            <section>
              <h2 className="font-display text-3xl">Up next</h2>
              <p className="mb-3 flex min-h-5 items-center gap-2 text-sm text-muted-foreground">
                {djBusy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {djErr ? <span className="text-destructive">{djErr}</span> : djNote || "Play any song — the AI DJ reads its mood and lines up similar songs."}
              </p>
              <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (mood.trim().length > 1) void askDj(`Mood or activity: ${mood}`); }}>
                <input value={mood} onChange={(e) => setMood(e.target.value)} maxLength={300} placeholder="Or describe a mood: rainy night drive…"
                  className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
                <button disabled={djBusy || mood.trim().length < 2} aria-label="Build queue from mood"
                  className="flex items-center gap-2 rounded-full bg-teal px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  <Sparkles className="h-4 w-4" /> Mix
                </button>
              </form>
              <List items={queued.length ? queued : all} />
            </section>
          </div>
        )}

        {view === "search" && (
          <section>
            <h1 className="mb-4 font-display text-5xl">Search</h1>
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a song by title"
                className="w-full rounded-2xl border border-border bg-card py-4 pl-12 pr-4 text-lg outline-none ring-ring focus:ring-2" />
            </div>
            <List items={filtered} empty={`No songs match "${query}".`} />
          </section>
        )}

        {view === "library" && (
          <section>
            <h1 className="font-display text-5xl">Library</h1>
            <p className="mb-6 text-sm text-muted-foreground">{tracks.length} songs · read-only · {status}</p>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {all.map(({ t, i }) => (
                <button key={t.id} onClick={() => pick(i)} className="group rounded-2xl border border-border bg-card/60 p-4 text-left transition-colors hover:bg-accent">
                  <Cover seed={t.title} spinning={current === i && playing} className="aspect-square w-full" />
                  <p className={cn("mt-3 truncate font-semibold", current === i && "text-primary")}>{t.title}</p>
                  <p className="text-xs text-muted-foreground">ME · ME</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === "playlists" && !openList && (
          <section>
            <h1 className="mb-6 font-display text-5xl">Playlists</h1>
            <div className="grid gap-5 sm:grid-cols-3">
              {playlists.map((p) => (
                <button key={p.id} onClick={() => setOpenList(p.id)} className="rounded-3xl border border-border bg-card/60 p-6 text-left transition-colors hover:bg-accent">
                  <Cover seed={p.name} className="h-24 w-24" />
                  <p className="mt-4 font-display text-2xl">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === "playlists" && openList && (() => {
          const p = playlists.find((x) => x.id === openList)!;
          return (
            <section>
              <button onClick={() => setOpenList(null)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> All playlists</button>
              <h1 className="font-display text-5xl">{p.name}</h1>
              <p className="mb-6 text-sm text-muted-foreground">{p.desc}</p>
              <List items={p.items} empty="Play a song from any page and the AI DJ will fill this playlist." />
            </section>
          );
        })()}
      </main>

      {/* Floating player dock */}
      <footer className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-5xl rounded-3xl border border-border bg-sidebar/95 px-4 py-3 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-4">
          <Cover seed={track?.title ?? "idle"} spinning={playing} className="h-12 w-12 shrink-0" />
          <div className="w-28 min-w-0 sm:w-44">
            <p className="truncate text-sm font-semibold">{track?.title ?? "Nothing playing"}</p>
            <p className="truncate text-xs text-muted-foreground">{track ? "ME · ME" : "Pick a song"}</p>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1">
            <div className="flex items-center gap-4">
              <button onClick={() => setShuffle(!shuffle)} aria-label="Shuffle" className={cn("hidden sm:block", shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground")}><Shuffle className="h-4 w-4" /></button>
              <button onClick={prev} aria-label="Previous" className="text-muted-foreground hover:text-foreground"><SkipBack className="h-5 w-5" /></button>
              <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="rounded-full bg-primary p-3 text-primary-foreground transition-transform hover:scale-105">
                {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              </button>
              <button onClick={() => next()} aria-label="Next" className="text-muted-foreground hover:text-foreground"><SkipForward className="h-5 w-5" /></button>
              <button onClick={() => setRepeat(repeat === "off" ? "all" : repeat === "all" ? "one" : "off")} aria-label="Repeat"
                className={cn("hidden sm:block", repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                {repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
              </button>
            </div>
            <div className="hidden w-full max-w-md items-center gap-2 text-xs text-muted-foreground md:flex">
              <span className="w-9 text-right">{fmt(time)}</span>
              <input type="range" min={0} max={dur || 0} step={0.1} value={time} aria-label="Seek"
                onChange={(e) => { const v = +e.target.value; setTime(v); if (audio.current) audio.current.currentTime = v; }} className="range-track flex-1" />
              <span className="w-9">{fmt(dur)}</span>
            </div>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <button onClick={() => setMuted(!muted)} aria-label="Mute" className="text-muted-foreground hover:text-foreground">
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} aria-label="Volume"
              onChange={(e) => { setVolume(+e.target.value); setMuted(false); }} className="range-track w-24" />
          </div>
        </div>
      </footer>

      <audio ref={audio} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => next(true)} />

      {settingsOpen && (
        <SettingsModal initial={folderId} onClose={() => setSettingsOpen(false)}
          onSave={(id) => { localStorage.setItem(STORAGE_KEY, id); setFolderId(id); void load(id); setSettingsOpen(false); }} />
      )}
    </div>
  );
}

function extractId(v: string) {
  const m = v.match(/folders\/([\w-]+)/) ?? v.match(/[?&]id=([\w-]+)/);
  return (m?.[1] ?? v).trim();
}

function SettingsModal({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (id: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-border bg-popover p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl">Google Drive folder</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste the folder ID or link. It must be shared as "Anyone with the link can view". MP3, WAV, FLAC, M4A, AAC and OGG are played.
        </p>
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. 1AbCdEfGh…"
          className="mt-4 w-full rounded-xl bg-secondary px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
        <div className="mt-6 flex justify-between gap-2">
          <button onClick={() => onSave("")} className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Use demo tracks</button>
          <button onClick={() => onSave(extractId(v))} className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground">Save & sync</button>
        </div>
      </div>
    </div>
  );
}

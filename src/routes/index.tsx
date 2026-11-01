import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Home, Search, Library, ListMusic, Settings, Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Repeat1, Volume2, VolumeX, Music2, X, Lock, Menu,
} from "lucide-react";
import { DEMO_TRACKS, driveStreamUrl, isAudioFile, makeTrack, type Track } from "@/lib/tracks";
import { listDriveFolder } from "@/lib/drive.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ME Music — Ads-free player" },
      { name: "description", content: "Stream every song from a public Google Drive folder, ads-free." },
      { property: "og:title", content: "ME Music — Ads-free player" },
      { property: "og:description", content: "Stream every song from a public Google Drive folder, ads-free." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Player,
});

const STORAGE_KEY = "drive-folder-id";
type View = "home" | "search" | "library" | "playlists";
const fmt = (s: number) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

function Cover({ seed, className }: { seed: string; className?: string }) {
  const h = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className={cn("flex items-center justify-center rounded-md", className)}
      style={{ background: `linear-gradient(135deg, oklch(0.55 0.15 ${h}), oklch(0.25 0.08 ${(h + 60) % 360}))` }}
    >
      <Music2 className="h-1/3 w-1/3 text-foreground/80" />
    </div>
  );
}

function Player() {
  const [folderId, setFolderId] = useState("");
  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS);
  const [status, setStatus] = useState<string>("Demo tracks");
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const audio = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off");

  const load = useCallback(async (id: string) => {
    if (!id) { setTracks(DEMO_TRACKS); setStatus("Demo tracks"); return; }
    setStatus("Syncing Google Drive…");
    try {
      const files = await listDriveFolder({ data: { folderId: id } });
      const list = files.filter((f) => isAudioFile(f.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map((f) => makeTrack(f.id, f.name, driveStreamUrl(f.id)));
      if (!list.length) { setTracks(DEMO_TRACKS); setStatus("No audio found in folder — showing demo tracks"); return; }
      setTracks(list); setCurrent(-1); setStatus(`${list.length} songs from Google Drive`);
    } catch {
      setTracks(DEMO_TRACKS); setStatus("Couldn't read folder — showing demo tracks");
    }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY) ?? "";
    setFolderId(id); void load(id);
  }, [load]);

  useEffect(() => { if (audio.current) audio.current.volume = muted ? 0 : volume; }, [volume, muted]);

  const track = current >= 0 ? tracks[current] : null;

  const playIndex = (i: number) => {
    const a = audio.current; if (!a) return;
    if (i === current) { a.paused ? a.play() : a.pause(); return; }
    setCurrent(i); a.src = tracks[i]?.src ?? ""; a.play().catch(() => {});
  };
  const next = (auto = false) => {
    if (!tracks.length) return;
    if (auto && repeat === "one") { audio.current!.currentTime = 0; audio.current!.play(); return; }
    let i = shuffle ? Math.floor(Math.random() * tracks.length) : current + 1;
    if (i >= tracks.length) { if (auto && repeat === "off") { setPlaying(false); return; } i = 0; }
    setCurrent(-2); playIndexForce(i);
  };
  const playIndexForce = (i: number) => {
    const a = audio.current!; setCurrent(i); a.src = tracks[i]?.src ?? ""; a.play().catch(() => {});
  };
  const prev = () => {
    const a = audio.current!;
    if (a.currentTime > 3 || current <= 0) { a.currentTime = 0; return; }
    playIndexForce(current - 1);
  };
  const toggle = () => { if (current < 0) playIndexForce(0); else playIndex(current); };

  const filtered = useMemo(
    () => tracks.map((t, i) => ({ t, i })).filter(({ t }) => t.title.toLowerCase().includes(query.toLowerCase())),
    [tracks, query],
  );

  const nav: { id: View; label: string; icon: typeof Home }[] = [
    { id: "home", label: "Home", icon: Home },
    { id: "search", label: "Search", icon: Search },
    { id: "library", label: "Library", icon: Library },
    { id: "playlists", label: "Playlists", icon: ListMusic },
  ];

  const Row = ({ t, i, n }: { t: Track; i: number; n: number }) => (
    <button onClick={() => playIndex(i)}
      className={cn("group grid w-full grid-cols-[2rem_1fr_auto] items-center gap-4 rounded-md px-3 py-2 text-left hover:bg-accent md:grid-cols-[2rem_1fr_8rem_8rem]",
        current === i && "text-primary")}>
      <span className="text-sm text-muted-foreground">
        {current === i && playing ? <Pause className="h-4 w-4 text-primary" /> : n}
      </span>
      <span className="flex min-w-0 items-center gap-3">
        <Cover seed={t.title} className="h-10 w-10 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{t.title}</span>
          <span className="block text-sm text-muted-foreground">{t.artist}</span>
        </span>
      </span>
      <span className="hidden text-sm text-muted-foreground md:block">{t.album}</span>
      <span className="text-sm text-muted-foreground md:text-right">{t.artist}</span>
    </button>
  );

  const Table = ({ items }: { items: { t: Track; i: number }[] }) => (
    <div>
      <div className="grid grid-cols-[2rem_1fr_auto] gap-4 border-b border-border px-3 pb-2 text-xs uppercase tracking-wider text-muted-foreground md:grid-cols-[2rem_1fr_8rem_8rem]">
        <span>#</span><span>Title</span><span className="hidden md:block">Album</span><span className="md:text-right">Artist</span>
      </div>
      <div className="mt-2">{items.map(({ t, i }, n) => <Row key={t.id} t={t} i={i} n={n + 1} />)}</div>
      {!items.length && <p className="py-10 text-center text-muted-foreground">No songs match "{query}".</p>}
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex min-h-0 flex-1 gap-2 p-2">
        {/* Sidebar */}
        <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 flex-col gap-2 bg-sidebar p-2 md:static md:flex md:rounded-lg",
          navOpen ? "flex" : "hidden")}>
          <div className="flex items-center justify-between px-4 py-4">
            <span className="flex items-center gap-2 text-xl font-extrabold"><Music2 className="text-primary" /> ME Music</span>
            <button className="md:hidden" onClick={() => setNavOpen(false)} aria-label="Close menu"><X /></button>
          </div>
          {nav.map((n) => (
            <button key={n.id} onClick={() => { setView(n.id); setNavOpen(false); }}
              className={cn("flex items-center gap-4 rounded-md px-4 py-2 font-bold transition-colors hover:text-foreground",
                view === n.id ? "text-foreground" : "text-muted-foreground")}>
              <n.icon className="h-5 w-5" /> {n.label}
            </button>
          ))}
          <div className="mt-4 rounded-lg bg-card p-4 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-bold text-foreground"><Lock className="h-4 w-4" /> Read-only library</p>
            <p className="mt-1">Free & ads-free. Only the owner adds songs via Google Drive.</p>
          </div>
          <button onClick={() => setSettingsOpen(true)} className="mt-auto flex items-center gap-3 rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            <Settings className="h-4 w-4" /> Drive settings
          </button>
        </aside>

        {/* Main */}
        <main className="bg-hero min-w-0 flex-1 overflow-y-auto rounded-lg">
          <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/60 px-6 py-4 backdrop-blur">
            <button className="md:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu /></button>
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => { setQuery(e.target.value); if (view !== "search") setView("search"); }}
                placeholder="What do you want to play?"
                className="w-full rounded-full bg-secondary py-2.5 pl-10 pr-4 text-sm outline-none ring-ring focus:ring-2" />
            </div>
            <span className="ml-auto hidden text-xs text-muted-foreground sm:block">{status}</span>
            <button onClick={() => setSettingsOpen(true)} aria-label="Settings" className="rounded-full bg-secondary p-2 hover:bg-accent"><Settings className="h-4 w-4" /></button>
          </header>

          <div className="px-6 pb-10">
            {view === "home" && (
              <>
                <h1 className="mb-6 mt-4 text-3xl font-extrabold">Good to see you</h1>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {tracks.slice(0, 12).map((t, i) => (
                    <button key={t.id} onClick={() => playIndex(i)} className="group rounded-lg bg-card/60 p-3 text-left transition-colors hover:bg-accent">
                      <div className="relative">
                        <Cover seed={t.title} className="aspect-square w-full shadow-lg" />
                        <span className={cn("absolute bottom-2 right-2 rounded-full bg-primary p-3 text-primary-foreground shadow-xl transition-all",
                          current === i && playing ? "opacity-100" : "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100")}>
                          {current === i && playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
                        </span>
                      </div>
                      <p className="mt-3 truncate font-bold">{t.title}</p>
                      <p className="text-sm text-muted-foreground">{t.artist} · {t.album}</p>
                    </button>
                  ))}
                </div>
                <h2 className="mb-4 mt-10 text-2xl font-bold">All songs</h2>
                <Table items={tracks.map((t, i) => ({ t, i }))} />
              </>
            )}
            {view === "search" && (<><h1 className="mb-6 mt-4 text-3xl font-extrabold">Search</h1><Table items={filtered} /></>)}
            {(view === "library" || view === "playlists") && (
              <>
                <div className="mb-8 mt-4 flex items-end gap-6">
                  <Cover seed={view} className="h-40 w-40 shadow-2xl" />
                  <div>
                    <p className="text-xs font-bold uppercase">{view === "library" ? "Library" : "Playlist"}</p>
                    <h1 className="text-4xl font-extrabold md:text-6xl">{view === "library" ? "Your Library" : "Everything by ME"}</h1>
                    <p className="mt-2 text-sm text-muted-foreground">{ME()} · {tracks.length} songs</p>
                  </div>
                </div>
                <button onClick={toggle} className="mb-6 rounded-full bg-primary p-4 text-primary-foreground transition-transform hover:scale-105" aria-label="Play">
                  {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
                </button>
                <Table items={tracks.map((t, i) => ({ t, i }))} />
              </>
            )}
          </div>
        </main>
      </div>

      {/* Player bar */}
      <footer className="grid grid-cols-[1fr_auto] items-center gap-4 bg-sidebar px-4 py-3 md:grid-cols-3">
        <div className="flex min-w-0 items-center gap-3">
          {track ? <Cover seed={track.title} className="h-14 w-14 shrink-0" /> : <div className="h-14 w-14 rounded-md bg-card" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{track?.title ?? "Nothing playing"}</p>
            <p className="truncate text-xs text-muted-foreground">{track ? `${track.artist} · ${track.album}` : "Pick a song"}</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-4">
            <button onClick={() => setShuffle(!shuffle)} aria-label="Shuffle" className={cn("hidden sm:block", shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground")}><Shuffle className="h-4 w-4" /></button>
            <button onClick={prev} aria-label="Previous" className="text-muted-foreground hover:text-foreground"><SkipBack className="h-5 w-5 fill-current" /></button>
            <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="rounded-full bg-foreground p-2 text-background transition-transform hover:scale-105">
              {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </button>
            <button onClick={() => next()} aria-label="Next" className="text-muted-foreground hover:text-foreground"><SkipForward className="h-5 w-5 fill-current" /></button>
            <button onClick={() => setRepeat(repeat === "off" ? "all" : repeat === "all" ? "one" : "off")} aria-label="Repeat"
              className={cn("hidden sm:block", repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              {repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </button>
          </div>
          <div className="hidden w-full max-w-xl items-center gap-2 text-xs text-muted-foreground md:flex">
            <span className="w-10 text-right">{fmt(time)}</span>
            <input type="range" min={0} max={dur || 0} step={0.1} value={time} aria-label="Seek"
              onChange={(e) => { const v = +e.target.value; setTime(v); if (audio.current) audio.current.currentTime = v; }}
              className="range-track flex-1" />
            <span className="w-10">{fmt(dur)}</span>
          </div>
        </div>
        <div className="hidden items-center justify-end gap-2 md:flex">
          <button onClick={() => setMuted(!muted)} aria-label="Mute" className="text-muted-foreground hover:text-foreground">
            {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} aria-label="Volume"
            onChange={(e) => { setVolume(+e.target.value); setMuted(false); }} className="range-track w-28" />
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

const ME = () => "ME";

function extractId(v: string) {
  const m = v.match(/folders\/([\w-]+)/) ?? v.match(/[?&]id=([\w-]+)/);
  return (m?.[1] ?? v).trim();
}

function SettingsModal({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (id: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-popover p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Google Drive folder</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste the folder ID or link. The folder must be shared as "Anyone with the link can view". MP3, WAV, FLAC, M4A, AAC and OGG are played.
        </p>
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. 1AbCdEfGh…"
          className="mt-4 w-full rounded-md bg-secondary px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
        <div className="mt-6 flex justify-between gap-2">
          <button onClick={() => onSave("")} className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Use demo tracks</button>
          <button onClick={() => onSave(extractId(v))} className="rounded-full bg-primary px-6 py-2 text-sm font-bold text-primary-foreground hover:scale-105">Save & sync</button>
        </div>
      </div>
    </div>
  );
}

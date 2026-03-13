

"use client";
import StreetLevelFooter from "./components/StreetLevelFooter";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import StreetLevelHeader from "./components/StreetLevelHeader";
import { formatShowDate } from "../lib/date";


type BandHeader = {
  band_slug: string;
  band_name: string | null;
  display_name: string | null;
  avatar_path: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  genre: string | null;
  bio: string | null;
};


type EventRow = {
  id: string;

  country: string | null;
  province: string | null;

  city: string | null;
  genre: string | null;
  show_date: string; // "YYYY-MM-DD"
  note: string | null; // event name
  flyer_path: string | null;
  track_id: string | null;
  created_at: string;
};

type TrackRow = {
  id: string;
  title: string;

  country: string | null;
  province: string | null;

  city: string;
  genre: string;
  is_radio: boolean;
  band_slug: string;
  file_path: string;
  art_path: string | null;
  created_at: string;
};

type TrackView = TrackRow & {
  url: string;
  artUrl: string;
  avatarUrl: string;
  flyerUrl?: string;
};

function getPublicUrl(path: string) {
  const res = supabase.storage.from("tracks").getPublicUrl(path);
  return res?.data?.publicUrl ?? "";
}

function getAvatarUrl(path: string | null) {
  if (!path) return "";
  const res = supabase.storage.from("avatars").getPublicUrl(path);
  return res?.data?.publicUrl ?? "";
}

function getArtworkUrl(path: string | null) {
  if (!path) return "";
  const res = supabase.storage.from("artwork").getPublicUrl(path);
  return res?.data?.publicUrl ?? "";
}

function getFlyerUrl(path: string | null) {
  if (!path) return "";
  const res = supabase.storage.from("flyers").getPublicUrl(path);
  return res?.data?.publicUrl ?? "";
}

function withCacheBust(url: string) {
  if (!url) return "";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${Date.now()}`;
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function norm(s: string | null | undefined) {
  return (s ?? "").trim();
}

function normSpaces(s: string) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function toTitleCaseSmart(input: string) {
  const s = normSpaces(input).toLowerCase();
  if (!s) return "";

  const minor = new Set([
    "and",
    "or",
    "the",
    "a",
    "an",
    "of",
    "to",
    "in",
    "on",
    "at",
    "for",
    "with",
  ]);

  return s
    .split(" ")
    .map((word, idx) => {
      const parts = word.split("-").map((p, pIdx) => {
        if (!p) return p;
        const isMinor = minor.has(p);
        const shouldLower = isMinor && !(idx === 0 && pIdx === 0);
        return shouldLower ? p : p[0].toUpperCase() + p.slice(1);
      });
      return parts.join("-");
    })
    .join(" ");
}

// ✅ local YYYY-MM-DD (avoids UTC “yesterday/tomorrow” issues)
function localTodayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// =========================
// Hardcoded location lists (seed)
// Start with Canada only.
// =========================
const COUNTRY_OPTIONS = ["Canada"] as const;

const PROVINCES_BY_COUNTRY: Record<string, string[]> = {
  Canada: [
    "Alberta",
    "British Columbia",
    "Manitoba",
    "New Brunswick",
    "Newfoundland and Labrador",
    "Nova Scotia",
    "Ontario",
    "Prince Edward Island",
    "Quebec",
    "Saskatchewan",
    "Northwest Territories",
    "Nunavut",
    "Yukon",
  ],
};

const CITIES_BY_PROVINCE: Record<string, string[]> = {
  Ontario: ["Ottawa", "Toronto", "Hamilton", "London", "Kingston", "Kitchener", "Windsor", "Sudbury"],
  Quebec: ["Montreal", "Quebec City", "Gatineau", "Sherbrooke"],
  "British Columbia": ["Vancouver", "Victoria", "Kelowna", "Surrey"],
  Alberta: ["Calgary", "Edmonton"],
  Manitoba: ["Winnipeg"],
  Saskatchewan: ["Saskatoon", "Regina"],
  "Nova Scotia": ["Halifax"],
  "New Brunswick": ["Moncton", "Fredericton", "Saint John"],
  "Newfoundland and Labrador": ["St. John's"],
  "Prince Edward Island": ["Charlottetown"],
  Yukon: ["Whitehorse"],
  Nunavut: ["Iqaluit"],
  "Northwest Territories": ["Yellowknife"],
};

type WhereStep = "country" | "province" | "city";

export default function HomePage() {
  const STREETLEVEL_LOGO = "/StreetLevelLogo-Punk.jpg"; // or png if you prefer
  const [bandHeader, setBandHeader] = useState<BandHeader | null>(null);
  const [status, setStatus] = useState("");

  
 

  // prevents the "rebuild queue on filtered change" effect from nuking our start
  const startingRef = useRef(false);


  // WHO
  const [q, setQ] = useState("");

  // EVENT SEARCH
  const [eventShowName, setEventShowName] = useState("");

  // WHAT
  const [genre, setGenre] = useState("");

  // WHERE
  const [country, setCountry] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");

  const [whereStep, setWhereStep] = useState<WhereStep>("country");

  // event / offline
  const [date, setDate] = useState("");
  const [offlineMode, setOfflineMode] = useState(false);

  const [eventMode, setEventMode] = useState(false);
  const [eventGenreOptions, setEventGenreOptions] = useState<string[]>([]);
  const [eventCityOptions, setEventCityOptions] = useState<string[]>([]);

  const [tracks, setTracks] = useState<TrackView[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [pendingFreshRound, setPendingFreshRound] = useState(false);

  // ✅ Calendar modal
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<EventRow[]>([]);

  // ✅ stable genres
  const [masterGenres, setMasterGenres] = useState<string[]>([]);

  // Playback
  const [queue, setQueue] = useState<TrackView[]>([]);
  const [nowPlaying, setNowPlaying] = useState<TrackView | null>(null);

 // ✅ NEW: history stack for "previous track"
  const [history, setHistory] = useState<TrackView[]>([]);
  const historyRef = useRef<TrackView[]>([]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // ✅ refs so MediaSession handlers always see latest state
  const nowPlayingRef = useRef<TrackView | null>(null);
  const queueRef = useRef<TrackView[]>([]);
  const goRef = useRef<() => void | Promise<void>>(() => {});

  useEffect(() => {
    nowPlayingRef.current = nowPlaying;
  }, [nowPlaying]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    goRef.current = go;
  }, [go]);


  // Autoplay
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const autoStartAfterEventPickRef = useRef(false);

  // UI
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  // Splash
  const [splashPhase, setSplashPhase] = useState<"off" | "show" | "fade">("show");

  // mobile detection (simple)
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 860);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ==========================
  // BANS (user-specific)
  // ==========================
  const [banIds, setBanIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);


  const banIdsRef = useRef<Set<string>>(new Set());

  
  useEffect(() => {
    banIdsRef.current = banIds;
  }, [banIds]);


  useEffect(() => {
  wireCarPlayHandlers();
  // set a baseline metadata so logo shows even before first play
  setCarPlayNowPlaying(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);



function setCarPlayNowPlaying(t: TrackView | null) {
  if (typeof window === "undefined") return;

  const ms: any = (navigator as any).mediaSession;
  const MM: any = (window as any).MediaMetadata;
  if (!ms || !MM) return;

  if (!t) {
    ms.metadata = new MM({
      title: "StreetLevel",
      artist: "",
      album: "StreetLevel",
      artwork: [
        { src: STREETLEVEL_LOGO, sizes: "512x512", type: "image/jpeg" },
      ],
    });

    try {
      ms.playbackState = "none";
    } catch {}

    return;
  }

  const artworkSrc =
    t.avatarUrl ||
    t.artUrl ||
    t.flyerUrl ||
    STREETLEVEL_LOGO;

  ms.metadata = new MM({
    title: t.title || "Untitled",
    artist: t.band_slug || "StreetLevel",
    album: "StreetLevel",
    artwork: [
      { src: artworkSrc, sizes: "512x512", type: "image/jpeg" },
      { src: STREETLEVEL_LOGO, sizes: "512x512", type: "image/jpeg" },
    ],
  });

  try {
    ms.playbackState = "playing";
  } catch {}
}

function wireCarPlayHandlers() {
  const ms: any = (navigator as any).mediaSession;
  if (!ms?.setActionHandler) return;

  try {
    ms.setActionHandler("play", async () => {
      const el = audioRef.current;
      if (!el) return;
      try {
        await el.play();
      } catch {}
    });
  } catch {}

  try {
    ms.setActionHandler("pause", () => {
      const el = audioRef.current;
      if (!el) return;
      el.pause();
    });
  } catch {}

  try {
    ms.setActionHandler("nexttrack", () => {
      goRef.current?.();
    });
  } catch {}

  try {
    ms.setActionHandler("previoustrack", async () => {
      const el = audioRef.current;
      const current = nowPlayingRef.current;

      if (!el || !current) return;

      if (el.currentTime > 3) {
        el.currentTime = 0;
        try {
          await el.play();
        } catch {}
        return;
      }

      const h = historyRef.current;
      const prev = h[0];

      if (!prev) {
        el.currentTime = 0;
        try {
          await el.play();
        } catch {}
        return;
      }

      setHistory((hh) => hh.slice(1));
      setQueue((q0) => [current, ...q0]);
      setNowPlaying(prev);
    });
  } catch {}

  try {
    ms.setActionHandler("seekbackward", (details: any) => {
      const el = audioRef.current;
      if (!el) return;
      const s = details?.seekOffset ?? 10;
      el.currentTime = Math.max(0, el.currentTime - s);
    });
  } catch {}

  try {
    ms.setActionHandler("seekforward", (details: any) => {
      const el = audioRef.current;
      if (!el) return;
      const s = details?.seekOffset ?? 10;
      el.currentTime = Math.min(el.duration || Infinity, el.currentTime + s);
    });
  } catch {}
}



  async function refreshBans() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        setBanIds(new Set());
        return;
      }

      // Table: user_banned_tracks (user_id, track_id)
      const { data, error } = await supabase
        .from("user_banned_tracks")
        .select("track_id")
        .eq("user_id", user.id);

      if (error) {
        // don't break radio if bans table isn't ready yet
        console.warn("ban load error:", error.message);
        return;
      }

      const s = new Set<string>((data ?? []).map((r: any) => String(r.track_id)));
      setBanIds(s);
    } catch (e) {
      console.warn("refreshBans failed:", e);
    }
  }

  useEffect(() => {
    async function syncAuth() {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data?.user?.id ?? null);
    }

    syncAuth();
    refreshBans();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      syncAuth();
      refreshBans();
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Ban confirm modal state
  const [banConfirmOpen, setBanConfirmOpen] = useState(false);
  const [banWorking, setBanWorking] = useState(false);
  const [banError, setBanError] = useState("");

  function requestBanNowPlaying() {
    setBanError("");
    if (!nowPlaying) return;

    if (!currentUserId) {
      setStatus("Log in to ban songs.");
      return;
    }

    setBanConfirmOpen(true);
  }

async function confirmBanNowPlaying() {
  setBanError("");
  const t = nowPlaying;
  if (!t) return;

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    setBanConfirmOpen(false);
    setStatus("Log in to ban songs (bans are saved per user).");
    return;
  }

  setBanWorking(true);

  try {
    const { error } = await supabase
      .from("user_banned_tracks")
      .upsert(
        [{ user_id: user.id, track_id: t.id }],
        { onConflict: "user_id,track_id" }
      );

    if (error) {
      setBanError(error.message);
      setBanWorking(false);
      return;
    }

    const currentId = t.id;

    // optimistic local update
    setBanIds((prev) => {
      const next = new Set(prev);
      next.add(currentId);
      return next;
    });

    // remove banned song from queue
    setQueue((q0) => q0.filter((x) => x.id !== currentId));

    setBanConfirmOpen(false);
    setBanWorking(false);

    // force immediate skip off the banned track
    const remainingQueue = queue.filter((x) => x.id !== currentId);
    const next = remainingQueue[0] ?? null;
    const rest = remainingQueue.slice(1);

    if (next) {
      setHistory((h) => [t, ...h].slice(0, 50));
      setNowPlaying(next);
      setQueue(rest);
    } else {
      setNowPlaying(null);
      setPendingFreshRound(true);
      await loadTracks();
    }
  } catch (e: any) {
    setBanError(e?.message ?? "Ban failed.");
    setBanWorking(false);
  }
}

  // ✅ pull filters from URL
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);

    const co = url.searchParams.get("country") ?? "";
    const pr = url.searchParams.get("province") ?? "";
    const ci = url.searchParams.get("city") ?? "";

    const g = url.searchParams.get("genre") ?? "";
    const d = url.searchParams.get("date") ?? "";
    const qq = url.searchParams.get("q") ?? "";
    const evn = url.searchParams.get("event") ?? "";
    const off = url.searchParams.get("offline") ?? "";

    if (co) setCountry(co);
    if (pr) setProvince(pr);
    if (ci) setCity(ci);

    if (g) setGenre(g);
    if (d) setDate(d);
    if (qq) setQ(qq);
    if (evn) setEventShowName(evn);

    if (off === "1" || off.toLowerCase() === "true") setOfflineMode(true);

    if (ci) setWhereStep("city");
    else if (pr) setWhereStep("province");
    else setWhereStep("country");

    const any = Boolean(co || pr || ci || g || d || qq || evn || off);
    if (any) {
      setFiltersOpen(false);
      setHasStarted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ After first load (and after the splash), render UI behind filters
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (splashPhase !== "off") return;

    setHasStarted(true);

    setNowPlaying(null);
    setAutoplayBlocked(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [splashPhase]);

  // ✅ One-time splash (per session)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const KEY = "sl_splash_seen_v1";
    const already = sessionStorage.getItem(KEY);

    if (already) {
      setSplashPhase("off");
      return;
    }

    sessionStorage.setItem(KEY, "1");

    const SHOW_MS = 1200;
    const FADE_MS = 3300;

    setSplashPhase("show");

    const t1 = window.setTimeout(() => setSplashPhase("fade"), SHOW_MS);
    const t2 = window.setTimeout(() => setSplashPhase("off"), SHOW_MS + FADE_MS + 50);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  // ✅ Filter panel sizing
  const FILTER_PANEL_MAX = 560;
  const FILTER_FIELD_MAX = 430;
  const FILTER_GO_MAX = FILTER_FIELD_MAX;

  function clearLocation() {
    setCountry("");
    setProvince("");
    setCity("");
    setWhereStep("country");
  }

  function pickEventAndPlay(ev: EventRow) {
    const showName = normSpaces(ev.note ?? "").toUpperCase();
    if (showName) {
      setEventShowName(showName);
      setDate("");
    } else {
      setEventShowName("");
      setDate((ev.show_date ?? "").slice(0, 10));
    }

    if (ev.country) setCountry(toTitleCaseSmart(ev.country));
    if (ev.province) setProvince(toTitleCaseSmart(ev.province));
    if (ev.city) setCity(toTitleCaseSmart(ev.city));
    if (ev.genre) setGenre(toTitleCaseSmart(ev.genre));

    setQ("");

    if (ev.city) setWhereStep("city");
    else if (ev.province) setWhereStep("city");
    else if (ev.country) setWhereStep("province");
    else setWhereStep("country");

    setHasStarted(true);
    setFiltersOpen(false);
    setCalendarOpen(false);

    autoStartAfterEventPickRef.current = true;
  }

  // keep URL in sync
  function syncUrl() {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);

    const setOrDel = (k: string, v: string) => {
      if (v && v.trim()) url.searchParams.set(k, v.trim());
      else url.searchParams.delete(k);
    };

    setOrDel("country", country);
    setOrDel("province", province);
    setOrDel("city", city);

    setOrDel("genre", genre);
    setOrDel("date", date);
    setOrDel("q", q);
    setOrDel("event", eventShowName);

    if (offlineMode) url.searchParams.set("offline", "1");
    else url.searchParams.delete("offline");

    window.history.replaceState({}, "", url.toString());
  }

  // ✅ Load calendar events once
  async function loadCalendarEvents() {
    setCalendarLoading(true);
    setCalendarError("");

    const today = localTodayISO();

    const { data, error } = await supabase
      .from("events")
      .select("id, country, province, city, genre, show_date, note, flyer_path, track_id, created_at")
      .gte("show_date", today)
      .order("show_date", { ascending: true })
      .order("created_at", { ascending: false });

    setCalendarLoading(false);

    if (error) {
      setCalendarError(error.message);
      setCalendarEvents([]);
      return;
    }

    setCalendarEvents((data ?? []) as EventRow[]);
  }

  // ✅ Only show upcoming events + only those matching current filters
  const calendarMatches = useMemo(() => {
    const today = localTodayISO();

    const co = country.trim().toLowerCase();
    const pr = province.trim().toLowerCase();
    const cc = city.trim().toLowerCase();
    const gg = genre.trim().toLowerCase();

    const filteredUpcoming = calendarEvents.filter((ev) => {
      const d = (ev.show_date ?? "").slice(0, 10);
      if (!d) return false;
      if (d < today) return false;

      const evCountry = (ev.country ?? "").toLowerCase();
      const evProvince = (ev.province ?? "").toLowerCase();
      const evCity = (ev.city ?? "").toLowerCase();
      const evGenre = (ev.genre ?? "").toLowerCase();

      const matchCountry = !co || evCountry.includes(co);
      const matchProvince = !pr || evProvince.includes(pr);
      const matchCity = !cc || evCity.includes(cc);
      const matchGenre = !gg || evGenre.includes(gg);

      return matchCountry && matchProvince && matchCity && matchGenre;
    });

    const seen = new Set<string>();
    const unique: EventRow[] = [];

    for (const ev of filteredUpcoming) {
      const d = (ev.show_date ?? "").slice(0, 10);
      const nameKey = normSpaces(ev.note ?? "").toUpperCase();
      const key = nameKey ? `${d}::${nameKey}` : `ID::${ev.id}`;

      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(ev);
      if (unique.length >= 200) break;
    }

    unique.sort((a, b) => {
      const da = (a.show_date ?? "").slice(0, 10);
      const db = (b.show_date ?? "").slice(0, 10);
      return da.localeCompare(db);
    });

    return unique;
  }, [calendarEvents, country, province, city, genre]);

  async function creditAdShareOnce(perPageTracks: TrackView[]) {
    if (offlineMode) return;

    const slugs = Array.from(
      new Set((perPageTracks ?? []).map((t) => (t.band_slug ?? "").trim()).filter(Boolean))
    );

    if (!slugs.length) return;

    const { error } = await supabase.rpc("increment_ad_share_for_band_slugs", {
      p_band_slugs: slugs,
    });

    if (error) {
      console.warn("ad_share increment failed:", error.message);
    }
  }

  // ============== DATA LOAD ==============
async function loadTracks(): Promise<TrackView[]> {
  if (offlineMode) {
    setStatus("Offline mode: not refreshing from server.");
    return [];
  }

  setIsLoadingTracks(true);
  setStatus("Loading...");

  try {
    const cleanEventName = normSpaces(eventShowName || "").toUpperCase();

    // ===== EVENT RADIO MODE =====
    if (date || cleanEventName) {
      setEventMode(true);

      let evQ = supabase
        .from("events")
        .select("id, country, province, city, genre, show_date, note, flyer_path, track_id, created_at")
        .order("created_at", { ascending: false });

      if (cleanEventName) {
        evQ = evQ.ilike("note", `%${cleanEventName}%`);
      }

      const { data: evs, error: evErr } = await evQ;

      if (evErr) {
        setStatus(`Event load error: ${evErr.message}`);
        setTracks([]);
        setEventGenreOptions([]);
        setEventCityOptions([]);
        return [];
      }

      const eventRows = (evs ?? []) as any[];

      // build dropdown options (event-mode)
      {
        const gset = new Set<string>();
        const cset = new Set<string>();
        for (const e of eventRows) {
          const g = norm(e.genre);
          const c = norm(e.city);
          if (g) gset.add(g);
          if (c) cset.add(c);
        }
        setEventGenreOptions(Array.from(gset).sort((a, b) => a.localeCompare(b)));
        setEventCityOptions(Array.from(cset).sort((a, b) => a.localeCompare(b)));
      }

      if (!cleanEventName && date && (!city.trim() || !genre.trim())) {
        setTracks([]);
        setStatus("Pick a date + city + genre to see event radio songs.");
        return [];
      }

      const filteredEvents = eventRows.filter((e) => {
        if (cleanEventName) {
          return (e.note ?? "").toUpperCase() === cleanEventName;
        }

        const c = (e.city ?? "").toLowerCase();
        const g = (e.genre ?? "").toLowerCase();
        return c.includes(city.trim().toLowerCase()) && g.includes(genre.trim().toLowerCase());
      });

      const trackIds = filteredEvents.map((e) => e.track_id).filter(Boolean) as string[];

      if (!trackIds.length) {
        setTracks([]);
        if (cleanEventName) setStatus(`No songs found for event name: ${cleanEventName}`);
        else setStatus(`No events found for ${date} with ${city} + ${genre}.`);
        return [];
      }

      const { data: ts, error: tErr } = await supabase
        .from("tracks")
        .select("id,title,country,province,city,genre,is_radio,band_slug,file_path,art_path,created_at")
        .in("id", trackIds);

      if (tErr) {
        setStatus(`Tracks load error: ${tErr.message}`);
        setTracks([]);
        return [];
      }

      const flyerByTrackId = new Map<string, string | null>();
      for (const e of filteredEvents) {
        if (e.track_id) flyerByTrackId.set(e.track_id, e.flyer_path ?? null);
      }

      const bandSlugs = Array.from(
        new Set((ts ?? []).map((r: any) => String(r.band_slug ?? "").trim()).filter(Boolean))
      );

      let avatarBySlug = new Map<string, string>();

      if (bandSlugs.length) {
        const { data: bandRows } = await supabase
          .from("band_users")
          .select("band_slug, avatar_path")
          .in("band_slug", bandSlugs)
          .order("user_id", { ascending: true });

        avatarBySlug = new Map<string, string>();
        for (const b of bandRows ?? []) {
          const slug = String((b as any).band_slug ?? "").trim();
          if (!slug || avatarBySlug.has(slug)) continue;
          avatarBySlug.set(slug, getAvatarUrl((b as any).avatar_path ?? null));
        }
      }

      const mappedRaw: TrackView[] = (ts ?? []).map((r: TrackRow) => {
        const flyerPath = flyerByTrackId.get(r.id) ?? null;
        const flyerUrl = flyerPath ? withCacheBust(getFlyerUrl(flyerPath)) : "";
        return {
          ...r,
          url: getPublicUrl(r.file_path),
          artUrl: getArtworkUrl(r.art_path),
          avatarUrl: avatarBySlug.get(r.band_slug) ?? "",
          flyerUrl,
        };
      });

      // ✅ filter out banned
      const mapped = mappedRaw.filter((t) => !banIdsRef.current.has(t.id));

      setTracks(mapped);

      setMasterGenres((prev) => {
        const s = new Set(prev.map((x) => norm(x)).filter(Boolean));
        for (const t of mapped) {
          const g = norm(t.genre);
          if (g) s.add(g);
        }
        return Array.from(s).sort((a, b) => a.localeCompare(b));
      });

      if (cleanEventName) setStatus(`Event search: ${cleanEventName}`);
      else setStatus(`Event radio for ${date}`);

      return mapped;
    }

    // ===== NORMAL RADIO MODE =====
    setEventMode(false);
    setEventGenreOptions([]);
    setEventCityOptions([]);

    const qRaw = q ?? "";
    const qClean = normSpaces(qRaw).trim();
    const qSlug = qClean.replace(/\s+/g, "-");

    // ✅ BAND MODE
    if (!qClean) setBandHeader(null);

    if (qClean) {
      const qLike = `%${qClean}%`;
      const qSlugGuess = qClean.trim().toLowerCase().replace(/\s+/g, "-");

      const { data: bands, error: bandErr } = await supabase
        .from("band_users")
        .select("band_slug, band_name, display_name")
        .or(
          [
            `band_slug.eq.${qSlugGuess}`,
            `band_slug.eq.${qClean.toLowerCase()}`,
            `band_name.ilike.${qLike}`,
            `display_name.ilike.${qLike}`,
          ].join(",")
        )
        .limit(25);

      if (bandErr) {
        console.warn("Band lookup error:", bandErr.message);
      }

      function scoreBand(b: any, qClean2: string) {
        const qq = qClean2.trim().toLowerCase();
        const qqSlug = qq.replace(/\s+/g, "-");

        const slug = (b.band_slug ?? "").trim().toLowerCase();
        const name = (b.band_name ?? "").trim().toLowerCase();
        const disp = (b.display_name ?? "").trim().toLowerCase();

        if (slug === qqSlug || slug === qq) return 1000;
        if (name === qq || disp === qq) return 900;

        if (slug.startsWith(qqSlug) || slug.startsWith(qq)) return 800;
        if (name.startsWith(qq) || disp.startsWith(qq)) return 700;

        if (slug.includes(qqSlug) || slug.includes(qq)) return 500;
        if (name.includes(qq) || disp.includes(qq)) return 400;

        return 0;
      }

      const candidates = (bands ?? [])
        .map((b) => ({ b, s: scoreBand(b, qClean) }))
        .sort((a, c) => c.s - a.s);

      const best = candidates[0]?.b ?? null;

      const matchedSlug = best?.band_slug?.trim() ?? "";

      if (matchedSlug) {
        // ✅ load band header/profile for the UI
        const { data: bh } = await supabase
          .from("band_users")
          .select("band_slug, band_name, display_name, avatar_path, country, province, city, genre, bio")
          .eq("band_slug", matchedSlug)
          .order("user_id", { ascending: true })
          .limit(1)
          .maybeSingle();

        setBandHeader((bh as any) ?? { band_slug: matchedSlug });

        const { data: all, error: allErr } = await supabase
          .from("tracks")
          .select("id,title,country,province,city,genre,is_radio,band_slug,file_path,art_path,created_at")
          .eq("band_slug", matchedSlug)
          .order("created_at", { ascending: false });

        if (allErr) {
          setStatus(`Band tracks load error: ${allErr.message}`);
          setTracks([]);
          return [];
        }

        const bandAvatarUrl = bh?.avatar_path ? getAvatarUrl(bh.avatar_path) : "";

        const mappedAllRaw: TrackView[] = (all ?? []).map((r: TrackRow) => ({
          ...r,
          url: getPublicUrl(r.file_path),
          artUrl: getArtworkUrl(r.art_path),
          avatarUrl: bandAvatarUrl,
          flyerUrl: "",
        }));

        const mappedAll = mappedAllRaw.filter((t) => !banIdsRef.current.has(t.id));

        setTracks(mappedAll);

        setMasterGenres((prev) => {
          const s = new Set(prev.map((x) => norm(x)).filter(Boolean));
          for (const t of mappedAll) {
            const g = norm(t.genre);
            if (g) s.add(g);
          }
          return Array.from(s).sort((a, b) => a.localeCompare(b));
        });

        setStatus(`Band mode: ${best?.band_name ?? matchedSlug} • ${mappedAll.length} song(s)`);
        return mappedAll;
      } else {
        // qClean exists but no actual band matched
        setBandHeader(null);
      }
    }

    // ===== NORMAL RADIO MODE (RPC) =====
    let { data, error } = await supabase.rpc("radio_pick_one_per_band_filtered", {
      p_country: country || null,
      p_province: province || null,
      p_city: city || null,
      p_genre: genre || null,
      p_q: qClean || null,
    });

    if ((!data || data.length === 0) && qSlug !== qClean && qSlug.length > 0) {
      const retry = await supabase.rpc("radio_pick_one_per_band_filtered", {
        p_country: country || null,
        p_province: province || null,
        p_city: city || null,
        p_genre: genre || null,
        p_q: qSlug || null,
      });

      if (!retry.error) {
        data = retry.data;
        error = retry.error;
      } else {
        error = retry.error;
      }
    }

    if (error) {
      setStatus(`Load error: ${error.message}`);
      return [];
    }

    const bandSlugs = Array.from(
      new Set((data ?? []).map((r: any) => String(r.band_slug ?? "").trim()).filter(Boolean))
    );

    let avatarBySlug = new Map<string, string>();

    if (bandSlugs.length) {
      const { data: bandRows } = await supabase
        .from("band_users")
        .select("band_slug, avatar_path")
        .in("band_slug", bandSlugs)
        .order("user_id", { ascending: true });

      avatarBySlug = new Map<string, string>();
      for (const b of bandRows ?? []) {
        const slug = String((b as any).band_slug ?? "").trim();
        if (!slug || avatarBySlug.has(slug)) continue;
        avatarBySlug.set(slug, getAvatarUrl((b as any).avatar_path ?? null));
      }
    }

    const mappedRaw: TrackView[] = (data ?? []).map((r: TrackRow) => ({
      ...r,
      url: getPublicUrl(r.file_path),
      artUrl: getArtworkUrl(r.art_path),
      avatarUrl: avatarBySlug.get(r.band_slug) ?? "",
      flyerUrl: "",
    }));

    const mapped = mappedRaw.filter((t) => !banIdsRef.current.has(t.id));

    setTracks(mapped);

    setMasterGenres((prev) => {
      const s = new Set(prev.map((x) => norm(x)).filter(Boolean));
      for (const t of mapped) {
        const g = norm(t.genre);
        if (g) s.add(g);
      }
      return Array.from(s).sort((a, b) => a.localeCompare(b));
    });

    setStatus(mapped.length ? "" : "No radio tracks yet.");
    return mapped;
  } finally {
    setIsLoadingTracks(false);
  }
}

  // Keep URL in sync while filters change, but do NOT auto-hit Supabase
  useEffect(() => {
    syncUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, country, province, city, genre, q, eventShowName, offlineMode]);

  // ============== OPTIONS ==============
  const genreOptions = useMemo(() => {
    if (date) return ["", ...eventGenreOptions];

    const s = new Set(masterGenres.map((x) => norm(x)).filter(Boolean));
    const current = norm(genre);
    if (current) s.add(current);

    return ["", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [date, eventGenreOptions, masterGenres, genre]);

  const cityOptions = useMemo(() => {
    if (date) return ["", ...eventCityOptions];
    const set = new Set<string>();
    for (const t of tracks) {
      const c = norm(t.city);
      if (c) set.add(c);
    }
    return ["", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [date, eventCityOptions, tracks]);

  // ============== CURRENT PLAYABLE LIST ==============
  // tracks already represent the LAST successful "RADIO LETS GO" fetch
  const filtered = useMemo(() => {
    return tracks.filter((t) => !banIds.has(t.id));
  }, [tracks, banIds]);

  
  // Build / repair queue when playable tracks change,
  // but do NOT interfere while RADIO LETS GO is actively starting playback.
  useEffect(() => {
    if (startingRef.current) return;

    if (!filtered.length) {
      setQueue([]);
      setNowPlaying(null);
      setAutoplayBlocked(false);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return;
    }

    const shuffled = shuffle(filtered);

    if (nowPlaying) {
      const withoutCurrent = shuffled.filter((t) => t.id !== nowPlaying.id);
      setQueue(withoutCurrent);

      if (!shuffled.some((t) => t.id === nowPlaying.id)) {
        setNowPlaying(null);
        setAutoplayBlocked(false);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      }
      return;
    }

    setQueue(shuffled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  // Auto-start after picking an event
  useEffect(() => {
    if (!autoStartAfterEventPickRef.current) return;
    if (!filtered.length) return;

    setHasStarted(true);
    setFiltersOpen(false);

    if (!nowPlaying) {
      go();
    }

    autoStartAfterEventPickRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length]);

  // After a fresh server reload (RPC), auto-start a new round
useEffect(() => {
  if (!pendingFreshRound) return;
  if (!filtered.length) return;

  const q2 = shuffle(filtered);
  const [next, ...rest] = q2;

  if (nowPlaying) setHistory((h) => [nowPlaying, ...h].slice(0, 50));

  setNowPlaying(next ?? null);
  setQueue(rest);
  setPendingFreshRound(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [pendingFreshRound, filtered.length]);

  // Try to start audio whenever nowPlaying changes
  useEffect(() => {
    if (!nowPlaying) {
      setCarPlayNowPlaying(null);
      return;
    }

    setCarPlayNowPlaying(nowPlaying);
    setAutoplayBlocked(false);

    const t = setTimeout(async () => {
      const el = audioRef.current;
      if (!el) return;
      try {
        await el.play();
        setAutoplayBlocked(false);
      } catch {
        setAutoplayBlocked(true);
      }
    }, 50);

    return () => clearTimeout(t);
  }, [nowPlaying?.id]);

async function go() {
  if (!filtered.length) return;

  // If queue empty, either reshuffle offline or reload online
  if (!queue.length) {
    if (offlineMode) {
      const q2 = shuffle(filtered);
      const [next, ...rest] = q2;

      // ✅ history push
      if (nowPlaying) setHistory((h) => [nowPlaying, ...h].slice(0, 50));

      setNowPlaying(next ?? null);
      setQueue(rest);
      return;
    }

    setPendingFreshRound(true);
    await loadTracks();
    return;
  }

  const [next, ...rest] = queue;

  // ✅ history push
  if (nowPlaying) setHistory((h) => [nowPlaying, ...h].slice(0, 50));

  setNowPlaying(next);
  setQueue(rest);
}

function playTrack(t: TrackView) {
  // ✅ history push for manual selections
  if (nowPlaying && nowPlaying.id !== t.id) {
    setHistory((h) => [nowPlaying, ...h].slice(0, 50));
  }

  setQueue((q0) => {
    const idx = q0.findIndex((x) => x.id === t.id);
    if (idx >= 0) {
      const rest = [...q0.slice(0, idx), ...q0.slice(idx + 1)];
      setNowPlaying(t);
      return rest;
    }

    const base = shuffle(filtered).filter((x) => x.id !== t.id);
    setNowPlaying(t);
    return base;
  });
}

  function onEndedAdvance() {
    go();
  }

  // ✅ Swipe remove from queue (session-only)
  function removeFromQueue(trackId: string) {
    setQueue((q0) => q0.filter((t) => t.id !== trackId));
  }

  // ============== Progressive WHERE handlers ==============
  const prettyBreadcrumb = useMemo(() => {
    const parts = [country, province, city].map((x) => normSpaces(x)).filter(Boolean);
    return parts;
  }, [country, province, city]);

  function resetBelow(step: WhereStep) {
    if (step === "country") {
      setProvince("");
      setCity("");
      setWhereStep("country");
      return;
    }
    if (step === "province") {
      setCity("");
      setWhereStep("province");
      return;
    }
    if (step === "city") {
      setWhereStep("city");
      return;
    }
  }

  function pickCountry(v: string) {
    const clean = toTitleCaseSmart(v);
    setCountry(clean);
    setProvince("");
    setCity("");
    setWhereStep("province");
  }

  function pickProvince(v: string) {
    const clean = toTitleCaseSmart(v);
    setProvince(clean);
    setCity("");
    setWhereStep("city");
  }

  function pickCity(v: string) {
    const clean = toTitleCaseSmart(v);
    setCity(clean);
    setWhereStep("city");
  }

  function openFilters() {
    setFiltersOpen(true);
  }

  function closeFilters() {
    setFiltersOpen(false);
  }

async function radioLetsGo() {
  if (isLoadingTracks) return;
  if (!hasStarted) return;

  startingRef.current = true;

  closeFilters();

  const loaded = await loadTracks();

  if (!loaded.length) {
    setQueue([]);
    setNowPlaying(null);
    setAutoplayBlocked(false);
    startingRef.current = false;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    return;
  }

  // credit only when we actually hit the server
  if (!offlineMode) {
    setTimeout(() => {
      creditAdShareOnce(loaded);
    }, 0);
  }

  const q2 = shuffle(loaded);
  const [next, ...rest] = q2;

  setHistory([]);
  setNowPlaying(next ?? null);
  setQueue(rest);
  setAutoplayBlocked(false);

  startingRef.current = false;
}


  const overlayTitle = useMemo(() => {
    if (date) return "Event Radio";
    return "StreetLevel.live";
  }, [date]);

  const mainMaxWidth = 1000;

  // ============================
  // Queue Row (Swipe-to-remove)
  // ============================
const QueueRow = memo(function QueueRow({ t }: { t: TrackView }) {
  const swipeEnabled = isNarrow; // ✅ swipe only on mobile/narrow screens

  const SWIPE_OPEN_AT = 70;
  const SWIPE_DELETE_AT = 145;
  const OPEN_X = -120;
  const TAP_SLOP = 8;

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);

  function closeRow() {
    setOpen(false);
    setDx(0);
  }

  function openRow() {
    setOpen(true);
    setDx(OPEN_X);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!swipeEnabled) return;

    startX.current = e.clientX;
    startY.current = e.clientY;
    dragging.current = true;
    moved.current = false;
    pointerIdRef.current = e.pointerId;

    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!swipeEnabled) return;

    if (!dragging.current) return;
    if (startX.current == null || startY.current == null) return;

    const deltaX = e.clientX - startX.current;
    const deltaY = e.clientY - startY.current;

    if (Math.abs(deltaX) > TAP_SLOP || Math.abs(deltaY) > TAP_SLOP) moved.current = true;

    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) return;

    const base = open ? OPEN_X : 0;
    const next = base + deltaX;

    const clamped = Math.max(-180, Math.min(0, next));
    setDx(clamped);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!swipeEnabled) return;

    dragging.current = false;

    const pid = pointerIdRef.current;
    if (pid != null) {
      try {
        (e.currentTarget as any).releasePointerCapture?.(pid);
      } catch {}
    }
    pointerIdRef.current = null;

    if (!moved.current) {
      if (open) closeRow();
      return;
    }

    if (dx <= -SWIPE_DELETE_AT) {
      removeFromQueue(t.id);
      return;
    }

    if (dx <= -SWIPE_OPEN_AT) openRow();
    else closeRow();
  }

    const thumb = eventMode ? (t.flyerUrl || t.avatarUrl || t.artUrl) : (t.avatarUrl || t.artUrl);

  // ✅ Desktop: no swipe, simple buttons
  if (!swipeEnabled) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "44px 1fr auto auto",
          gap: 10,
          alignItems: "center",
          border: "1px solid #eee",
          borderRadius: 14,
          padding: "10px 12px",
          background: "white",
        }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              objectFit: "cover",
              border: "1px solid #eee",
            }}
          />
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: "1px solid #eee",
              opacity: 0.25,
            }}
          />
        )}

        {/* ✅ band link preserved */}
        <Link
          href={`/b/${t.band_slug}`}
          style={{
            textDecoration: "none",
            color: "inherit",
            minWidth: 0,
            display: "block",
          }}
          title={`Open ${t.band_slug}`}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 950,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {t.title}
            </div>
            <div
              style={{
                fontSize: 12,
                opacity: 0.75,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {t.city} • {t.genre} • {t.band_slug}
            </div>
          </div>
        </Link>

        <button
          onClick={(e) => {
            e.stopPropagation();
            playTrack(t);
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            fontWeight: 900,
            background: "black",
            color: "#2bff00",
          }}
        >
          Play
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            removeFromQueue(t.id);
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: "1px solid #ddd",
            fontWeight: 950,
            background: "black",
            color: "white",
            cursor: "pointer",
          }}
          title="Remove from queue"
        >
          ✕
        </button>
      </div>
    );
  }

  // ✅ Mobile: swipe-to-reveal remove
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 14,
          background: "rgba(0, 0, 0, 0.25)",
          border: "1px solid rgba(47, 47, 47, 0.33)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 10,
          gap: 10,
        }}
      >
        <button
          onClick={() => removeFromQueue(t.id)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,0,0,0.45)",
            background: "rgba(47, 47, 47, 0.33)",
            color: "rgba(200,0,0,0.95)",
            fontWeight: 950,
            cursor: "pointer",
          }}
          title="Remove from queue"
        >
          Remove
        </button>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          transform: `translateX(${open ? OPEN_X : dx}px)`,
          transition: dragging.current ? "none" : "transform 160ms ease",
          touchAction: "pan-y",
          display: "grid",
          gridTemplateColumns: "44px 1fr auto",
          gap: 10,
          alignItems: "center",
          border: "1px solid #eee",
          borderRadius: 14,
          padding: "10px 12px",
          background: "white",
        }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              objectFit: "cover",
              border: "1px solid #eee",
            }}
          />
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: "1px solid #eee",
              opacity: 0.25,
            }}
          />
        )}

        <Link
          href={`/b/${t.band_slug}`}
          onClick={(e) => {
            // If they tap the link while open, close first
            if (open) closeRow();
            e.stopPropagation();
          }}
          style={{
            textDecoration: "none",
            color: "inherit",
            minWidth: 0,
            display: "block",
          }}
          title={`Open ${t.band_slug}`}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 950,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {t.title}
            </div>
            <div
              style={{
                fontSize: 12,
                opacity: 0.75,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {t.city} • {t.genre} • {t.band_slug}
            </div>
          </div>
        </Link>

        <button
          onClick={(e) => {
            e.stopPropagation();
            playTrack(t);
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            fontWeight: 900,
            background: "black",
            color: "#2bff00",
          }}
        >
          Play
        </button>
      </div>
    </div>
  );
});


  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        background: "white",
        color: "black",
      }}
    >
      {/* ✅ SPLASH SCREEN */}
      {splashPhase !== "off" ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100000,
            background: "white",
            display: "grid",
            placeItems: "center",
            padding: 18,
            opacity: splashPhase === "fade" ? 0 : 1,
            transition: "opacity 1200ms ease",
            pointerEvents: "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/StreetLevelLogo(Punk).png"
            alt="StreetLevel"
            style={{
              width: "min(92vw, 860px)",
              height: "auto",
              borderRadius: 18,
              display: "block",
            }}
          />
        </div>
      ) : null}

      {/* ===== HERO ===== */}
      {!hasStarted && filtersOpen ? (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 18,
          }}
        >
          <div style={{ width: "min(780px, 92vw)", textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/StreetLevelLogo-Punk.jpg"
              alt="StreetLevel"
              style={{
                width: "100%",
                height: "auto",
                borderRadius: 18,
                border: "1px solid #eee",
                display: "block",
              }}
            />
          </div>
        </div>
      ) : null}

      {/* ===== Header + main content ===== */}
      {hasStarted || !filtersOpen ? (
        <div style={{ padding: 18 }}>
          <div style={{ maxWidth: mainMaxWidth, margin: "0 auto" }}>
            <StreetLevelHeader
              left={
                <button
                  onClick={go}
                  disabled={!filtered.length || isLoadingTracks}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    fontWeight: 950,
                    background: "black",
                    color: "#2bff00",
                    opacity: filtered.length && !isLoadingTracks ? 1 : 0.45,
                    cursor: filtered.length && !isLoadingTracks ? "pointer" : "not-allowed",
                    whiteSpace: "nowrap",
                  }}
                  title="Play / Next"
                >
                  Play / Next
                </button>
              }
              leftSub={
                <>
                  Songs in queue: <b>{queue.length}</b>
                  {status ? <> • {status}</> : null}
                </>
              }
              right={
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    onClick={openFilters}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      fontWeight: 950,
                      background: "black",
                      color: "white",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                    title="Open filters"
                  >
                    Filters
                  </button>

                  <Link
                    href="/band"
                    style={{
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      textDecoration: "none",
                      fontWeight: 950,
                      whiteSpace: "nowrap",
                      background: "black",
                      color: "white",
                      display: "inline-block",
                    }}
                  >
                    Log in
                  </Link>
                </div>
              }
            />

            {/* Event mode note */}
            {date ? (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
                Event radio matches using <b>City + Genre</b>.
              </div>
            ) : null}

            {/* ===== MAIN LAYOUT ===== */}
            <div
              style={{
                marginTop: 18,
                display: "grid",
                gridTemplateColumns: isNarrow ? "1fr" : "360px 1fr",
                gap: 14,
                alignItems: "start",
              }}
            >
              {/* LEFT: Now Playing */}
              <div>
                {nowPlaying ? (
                  <section
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 18,
                      padding: 14,
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 0.7, fontWeight: 900 }}>
                      NOW PLAYING
                    </div>

                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 22, fontWeight: 950, lineHeight: 1.1 }}>
  {bandHeader
    ? (bandHeader.display_name || bandHeader.band_name || bandHeader.band_slug)
    : (nowPlaying.title || "Untitled")}
</div>

{bandHeader ? (
  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
    Now playing: <b>{nowPlaying.title || "Untitled"}</b>
  </div>
) : null}

<div style={{ fontSize: 12, opacity: 0.75 }}>
  {bandHeader ? (
    <>
      {(bandHeader.genre || "—")} • {(bandHeader.city || "—")}
      {bandHeader.province ? `, ${bandHeader.province}` : ""}
      {bandHeader.country ? `, ${bandHeader.country}` : ""}
      {" • "}
      {(bandHeader.band_slug || "—")}
    </>
  ) : (
    <>
      {(nowPlaying.city || "—")} • {(nowPlaying.genre || "—")} • {(nowPlaying.band_slug || "—")}
    </>
  )}
</div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <Link
                            href={`/b/${nowPlaying.band_slug}`}
                            style={{
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: "1px solid #ddd",
                              textDecoration: "none",
                              fontWeight: 950,
                              background: "black",
                              color: "white",
                              display: "inline-block",
                            }}
                            title="Open band page"
                          >
                            Open Band Page →
                          </Link>

  <button
    onClick={requestBanNowPlaying}
    disabled={!currentUserId}
    style={{
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #ddd",
      fontWeight: 950,
      background: currentUserId ? "white" : "#f3f3f3",
      color: currentUserId ? "black" : "#888",
      cursor: currentUserId ? "pointer" : "not-allowed",
      opacity: currentUserId ? 1 : 0.7,
    }}
    title={
      currentUserId
        ? `Never play ${nowPlaying.band_slug || "this band"} — ${nowPlaying.title || "this song"} again`
        : "Log in to ban songs"
    }
  >
    {currentUserId ? "Ban Song!" : "Log in to ban"}
  </button>
                        </div>
                      </div>

                      {nowPlaying.url ? (
                        <div style={{ paddingTop: 6 }}>
<audio
  ref={audioRef}
  key={nowPlaying.id}
  controls
  autoPlay
  src={nowPlaying.url}
  style={{
    width: "100%",
    height: 46,
  }}
  onEnded={onEndedAdvance}
  onPlay={() => {
    setAutoplayBlocked(false);
    const ms: any = (navigator as any).mediaSession;
    if (ms) {
      try {
        ms.playbackState = "playing";
      } catch {}
    }
  }}
  onPause={() => {
    const ms: any = (navigator as any).mediaSession;
    if (ms) {
      try {
        ms.playbackState = "paused";
      } catch {}
    }
  }}
/>
                        </div>
                      ) : null}

                      {autoplayBlocked ? (
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          Autoplay was blocked by the browser — click <b>Play</b> once to start.
                        </div>
                      ) : null}

{(() => {
  const bandAvatarUrl = bandHeader?.avatar_path
    ? getAvatarUrl(bandHeader.avatar_path)
    : "";

  const nowImageUrl = eventMode
    ? (nowPlaying.flyerUrl || nowPlaying.avatarUrl || bandAvatarUrl || nowPlaying.artUrl)
    : (nowPlaying.avatarUrl || bandAvatarUrl || nowPlaying.artUrl);

  return nowImageUrl ? (

    // eslint-disable-next-line @next/next/no-img-element
<img
  src={nowImageUrl}
  alt={bandHeader ? "Band avatar" : "Now playing artwork"}
  style={{
    width: "100%",
    aspectRatio: "1 / 1",
    objectFit: "contain",          // ✅ key change: no crop
    borderRadius: 16,
    border: "1px solid #eee",
    marginTop: 8,
    background: "#f6f6f6",         // ✅ makes the empty space look nice
    display: "block",
  }}
/>
  ) : null;
})()}
                    </div>
                  </section>
) : bandHeader ? (
  <section
    style={{
      border: "1px solid #eee",
      borderRadius: 18,
      padding: 14,
    }}
  >
    <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 0.7, fontWeight: 900 }}>
      BAND MODE
    </div>

    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
      <div style={{ fontSize: 22, fontWeight: 950, lineHeight: 1.1 }}>
        {bandHeader.display_name || bandHeader.band_name || bandHeader.band_slug}
      </div>

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        {(bandHeader.genre || "—")} • {(bandHeader.city || "—")}
        {bandHeader.province ? `, ${bandHeader.province}` : ""}
        {bandHeader.country ? `, ${bandHeader.country}` : ""} • {bandHeader.band_slug}
      </div>

      {bandHeader.avatar_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getAvatarUrl(bandHeader.avatar_path)}
          alt="Band avatar"
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            objectFit: "cover",
            borderRadius: 16,
            border: "1px solid #eee",
            marginTop: 8,
          }}
        />
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Link
          href={`/b/${bandHeader.band_slug}`}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            textDecoration: "none",
            fontWeight: 950,
            background: "black",
            color: "white",
            display: "inline-block",
          }}
          title="Open band page"
        >
          Open Band Page →
        </Link>
      </div>

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        No playable songs in your queue. (If you banned them all, that’s why!)
      </div>
    </div>
  </section>
) : (
  <section
    style={{
      border: "1px solid #eee",
      borderRadius: 18,
      padding: 14,
    }}
  >
    <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 0.7, fontWeight: 900 }}>
      NOW PLAYING
    </div>
    <div style={{ marginTop: 10, fontWeight: 950, lineHeight: 1.2 }}>Nothing playing yet.</div>
    <div style={{ marginTop: 6, fontSize: 13, opacity: 0.7 }}>
      Hit <b>Play / Next</b> or open <b>Filters</b> and smash <b>RADIO LETS GO</b>.
    </div>
  </section>
)}
              </div>

              {/* RIGHT: Queue */}
              <section style={{ display: "grid", gap: 8 }}>
                {queue.map((t) => (
                  <QueueRow key={t.id} t={t} />
                ))}
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== BAN CONFIRM MODAL ===== */}
      {banConfirmOpen ? (
        <div
          onClick={() => (banWorking ? null : setBanConfirmOpen(false))}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20000,
            background: "rgba(0,0,0,0.72)",
            display: "grid",
            placeItems: "center",
            padding: 14,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 96vw)",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(20,20,20,0.95)",
              color: "white",
              overflow: "hidden",
              boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
            }}
          >
            <div style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
              <div style={{ fontWeight: 950, letterSpacing: 0.5 }}>Never play this song again?</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                {nowPlaying?.title ?? "—"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                {nowPlaying?.band_slug ?? "—"}
              </div>

            </div>

            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              {banError ? <div style={{ fontSize: 12, color: "#ffb3b3" }}>Error: {banError}</div> : null}

              <div style={{ fontSize: 12, opacity: 0.7 }}>
                This ban is saved to your account and applies to future radio sessions. it can be undone by visiting that bands page, and clicking to "Lift Song Ban" the song
              </div>


              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  disabled={banWorking}
                  onClick={() => setBanConfirmOpen(false)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #2bff002d",
                    background: "rgba(255, 255, 255, 0.1)",
                    color: "#2bff00",
                    fontWeight: 900,
                    cursor: banWorking ? "not-allowed" : "pointer",
                    opacity: banWorking ? 0.6 : 1,
                  }}
                >
                  Cancel
                </button>

                <button
                  disabled={banWorking}
                  onClick={confirmBanNowPlaying}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #ff0d002e",
                    background: "rgba(255, 255, 255, 0.1)",
                    color: "#ff0d00",
                    fontWeight: 950,
                    cursor: banWorking ? "not-allowed" : "pointer",
                    opacity: banWorking ? 0.75 : 1,
                  }}
                  title="Ban and skip"
                >
                  {banWorking ? "Banning..." : "Ban + Skip"}
                </button>
              </div>


            </div>
          </div>
        </div>
      ) : null}

      {/* ===== FILTER OVERLAY ===== */}
      {filtersOpen ? (
        <div
          onClick={() => {
            if (hasStarted) closeFilters();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: 14,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: `min(${FILTER_PANEL_MAX}px, 96vw)`,
              borderRadius: 18,
              border: "1px solid rgba(255, 255, 255, 0.34)",
              background: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                borderBottom: "1px solid #eee",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/favicon.ico"
                  alt=""
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    display: "block",
                  }}
                />

                <div
                  style={{
                    fontWeight: 950,
                    color: "white",
                    letterSpacing: 1,
                    textAlign: "center",
                    fontSize: 16,
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(43,255,0,0.35)",
                    background: "rgba(0,0,0,0.45)",
                    textShadow: "0 0 10px rgba(43,255,0,0.55), 0 0 22px rgba(43,255,0,0.28)",
                    boxShadow: "0 0 16px rgba(43,255,0,0.22)",
                  }}
                >
                  {overlayTitle}
                </div>
              </div>

              {hasStarted ? (
                <button
                  onClick={closeFilters}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: 14,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "black",
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                  title="Close"
                >
                  ✕
                </button>
              ) : null}
            </div>

            <div
              style={{
                padding: 14,
                display: "grid",
                gap: 12,
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: `${FILTER_FIELD_MAX}px`,
                  margin: "0 auto",
                  display: "grid",
                  gap: 10,
                }}
              >
                {/* WHAT */}
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 950, color: "white", letterSpacing: 0.7 }}>
                    What Genre?:)
                  </div>
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} className="sl-select">
                    {(genreOptions.length ? genreOptions : [""]).map((g) => (
                      <option key={g || "any"} value={g}>
                        {g || "Any genre"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* WHERE */}
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 950, color: "white", letterSpacing: 0.7 }}>
                    From Where?:
                  </div>

                  {prettyBreadcrumb.length ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        alignItems: "center",
                        fontSize: 12,
                        opacity: 0.9,
                      }}
                    >
                      {prettyBreadcrumb.map((p, idx) => {
                        const isLast = idx === prettyBreadcrumb.length - 1;
                        return (
                          <button
                            key={`${p}-${idx}`}
                            type="button"
                            onClick={() => {
                              if (idx === 0) resetBelow("country");
                              if (idx === 1) resetBelow("province");
                              if (idx === 2) resetBelow("city");
                            }}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 999,
                              border: "1px solid #ddd",
                              background: isLast ? "black" : "white",
                              color: isLast ? "white" : "black",
                              fontWeight: 900,
                              cursor: "pointer",
                            }}
                            title="Tap to go back / change this level"
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "white", opacity: 0.65 }}>
                      Optional. Pick country/province/city.. or leave blank.
                    </div>
                  )}

                  {whereStep === "country" ? (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0, maxWidth: FILTER_FIELD_MAX }}>
                        <select
                          value={country}
                          onChange={(e) => pickCountry(e.target.value)}
                          className="sl-select"
                          style={{ width: "100%" }}
                        >
                          <option value="">Any country</option>
                          {COUNTRY_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={clearLocation}
                        disabled={!country && !province && !city}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          background: "black",
                          color: "#2bff00",
                          fontWeight: 950,
                          cursor: !country && !province && !city ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          opacity: !country && !province && !city ? 0.45 : 1,
                        }}
                        title="Clear all location filters"
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}

                  {whereStep === "province" ? (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0, maxWidth: FILTER_FIELD_MAX }}>
                        <select
                          value={province}
                          onChange={(e) => pickProvince(e.target.value)}
                          className="sl-select"
                          style={{ width: "100%" }}
                        >
                          <option value="">Any province</option>
                          {(PROVINCES_BY_COUNTRY[country || "Canada"] ?? PROVINCES_BY_COUNTRY["Canada"]).map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={clearLocation}
                        disabled={!country && !province && !city}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          background: "black",
                          color: "#2bff00",
                          fontWeight: 950,
                          cursor: !country && !province && !city ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          opacity: !country && !province && !city ? 0.45 : 1,
                        }}
                        title="Clear all location filters"
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}

                  {whereStep === "city" ? (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0, maxWidth: FILTER_FIELD_MAX }}>
                        <select
                          value={city}
                          onChange={(e) => pickCity(e.target.value)}
                          className="sl-select"
                          style={{ width: "100%" }}
                        >
                          <option value="">Any city</option>

                          {(CITIES_BY_PROVINCE[province] ?? []).map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}

                          {date
                            ? cityOptions
                                .filter((x) => x)
                                .map((c) => (
                                  <option key={`ev-${c}`} value={c}>
                                    {c}
                                  </option>
                                ))
                            : null}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={clearLocation}
                        disabled={!country && !province && !city}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          background: "black",
                          color: "#2bff00",
                          fontWeight: 950,
                          cursor: !country && !province && !city ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          opacity: !country && !province && !city ? 0.45 : 1,
                        }}
                        title="Clear all location filters"
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* WHO */}
                <div style={{ display: "grid", gap: 10 }}>
                  {/* Event search + Calendar */}
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 950, color: "white", letterSpacing: 0.7 }}>
                      Event search (exact show name):
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        value={eventShowName}
                        onChange={(e) => setEventShowName(e.target.value.toUpperCase())}
                        placeholder="EX: MAYHEM FEST"
                        className="sl-input"
                        title="Exact match. Saved in CAPS in events.note."
                        style={{
                          flex: 1,
                          minWidth: 0,
                          maxWidth: `${FILTER_FIELD_MAX}px`,
                        }}
                      />

                      <button
                        type="button"
onClick={async () => {
  setCalendarOpen(true);
  await loadCalendarEvents(); // always refresh so deletions/edits don't look like ghosts
}}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          background: "black",
                          color: "white",
                          fontWeight: 950,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                        title="Browse matching upcoming events"
                      >
                        Calendar
                      </button>
                    </div>

                    <div style={{ fontSize: 12, color: "white", opacity: 0.7, lineHeight: 1.35 }}>
                      Tip: this loads only tracks submitted under that event name.
                    </div>
                  </div>

                  {/* BAND/SONG SEARCH */}
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 950, color: "white", letterSpacing: 0.7 }}>
                      Band / song search:
                    </div>

                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Band name (or song title)"
                      className="sl-input"
                      style={{ width: "100%", maxWidth: `${FILTER_FIELD_MAX}px` }}
                    />
                  </div>
                </div>

                {/* Offline */}
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, color: "white", fontWeight: 900 }}>
                    <input type="checkbox" checked={offlineMode} onChange={(e) => setOfflineMode(e.target.checked)} />
                    Offline mode (don’t refresh from server)
                  </label>
                </div>

                {/* GO */}
                <div
                  style={{
                    position: "sticky",
                    bottom: 0,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: "rgba(0,0,0,0.35)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    borderTop: "1px solid #eee",
                    marginTop: 6,
                  }}
                >
<button
  onClick={radioLetsGo}
  disabled={isLoadingTracks || !hasStarted}
  style={{
    width: "100%",
    maxWidth: `${FILTER_GO_MAX}px`,
    margin: "0 auto",
    display: "block",
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid #ddd",
    fontWeight: 950,
    background: "black",
    color: "#2bff00",
    cursor: isLoadingTracks || !hasStarted ? "not-allowed" : "pointer",
    letterSpacing: 0.6,
    opacity: isLoadingTracks || !hasStarted ? 0.6 : 1,
  }}
  title="Start the radio with whatever you picked (or nothing!)"
>
  {!hasStarted || isLoadingTracks ? "LOADING..." : "RADIO LETS GO!"}
</button>
                </div>

                <div style={{ fontSize: 12, color: "white", opacity: 0.7, lineHeight: 1.35 }}>
                  Tip: You can hit GO with <b>any</b> selection — genre only, city only, band name only… even nothing.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== CALENDAR MODAL ===== */}
      {calendarOpen ? (
        <div
          onClick={() => setCalendarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10050,
            background: "rgba(0,0,0,0.65)",
            display: "grid",
            placeItems: "center",
            padding: 14,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(760px, 96vw)",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(20,20,20,0.92)",
              color: "white",
              overflow: "hidden",
              boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                padding: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <div style={{ fontWeight: 950, letterSpacing: 0.6 }}>Calendar • Upcoming events matching your filters</div>

              <button
                onClick={() => setCalendarOpen(false)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: "black",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: 14,
                maxHeight: "70vh",
                overflowY: "auto",
                display: "grid",
                gap: 10,
              }}
            >
              {calendarLoading ? <div style={{ opacity: 0.85 }}>Loading events…</div> : null}
              {calendarError ? <div style={{ opacity: 0.85 }}>Error: {calendarError}</div> : null}

              {!calendarLoading && !calendarError && !calendarEvents.length ? (
                <div style={{ opacity: 0.85 }}>No events in database yet.</div>
              ) : null}

              {!calendarLoading && !calendarError && calendarEvents.length > 0 && calendarMatches.length === 0 ? (
                <div style={{ opacity: 0.85 }}>
                  No upcoming events match your current filters (City: <b>{city || "Any"}</b>, Genre: <b>{genre || "Any"}</b>).
                </div>
              ) : null}

              {calendarMatches.map((ev) => {
                const d = formatShowDate(ev.show_date, { weekday: true });
                const name = normSpaces(ev.note ?? "") || "(Unnamed event)";
                const meta = `${ev.city ?? "—"}, ${ev.province ?? "—"}, ${ev.country ?? "—"} • ${ev.genre ?? "—"}`;

                                const flyer = ev.flyer_path ? getFlyerUrl(ev.flyer_path) : "";

                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => pickEventAndPlay(ev)}
                    style={{
                      textAlign: "left",
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.08)",
                      color: "white",
                      cursor: "pointer",
                      display: "grid",
                      gridTemplateColumns: "52px 1fr",
                      gap: 12,
                      alignItems: "center",
                    }}
                    title="Pick this event and start playing"
                  >
                    {flyer ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={flyer}
                        alt=""
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 12,
                          objectFit: "cover",
                          border: "1px solid rgba(255,255,255,0.16)",
                          background: "rgba(0,0,0,0.35)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.16)",
                          background: "rgba(0,0,0,0.25)",
                          opacity: 0.55,
                        }}
                      />
                    )}

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {d} — {name}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {meta}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <StreetLevelFooter />
    </main>
  );
}

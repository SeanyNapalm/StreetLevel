

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import StreetLevelHeader from "./components/StreetLevelHeader";

type TrackRow = {
  id: string;
  title: string;

  // ✅ location snapshot copied from profile at upload time
  country: string | null;
  province: string | null;
  neighbourhood: string | null;
  city: string;

  genre: string;
  is_radio: boolean;
  band_slug: string;
  file_path: string;
  art_path: string | null;
  created_at: string;
};

type TrackView = TrackRow & { url: string; artUrl: string; flyerUrl?: string };

function getPublicUrl(path: string) {
  const res = supabase.storage.from("tracks").getPublicUrl(path);
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

  const minor = new Set(["and", "or", "the", "a", "an", "of", "to", "in", "on", "at", "for", "with"]);

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

// =========================
// Hardcoded location lists (seed)
// Start with Canada only.
// You can expand this later.
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

const NEIGHBOURHOODS_BY_CITY: Record<string, string[]> = {
  Ottawa: ["Vanier", "Centretown", "ByWard Market", "Hintonburg", "Old Ottawa South", "Nepean", "Barrhaven", "Kanata"],
  Toronto: ["Downtown", "Scarborough", "North York", "Etobicoke", "The Annex", "Parkdale"],
  Montreal: ["Plateau", "Mile End", "Downtown", "Hochelaga", "Verdun"],
  Gatineau: ["Hull", "Aylmer"],
};

type WhereStep = "country" | "province" | "city" | "neighbourhood";

export default function HomePage() {
  
  const [status, setStatus] = useState("");

  // WHO
  const [q, setQ] = useState(""); // band name or song title search

  // WHAT
  const [genre, setGenre] = useState("");

  // WHERE (progressive)
  const [country, setCountry] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [neighbourhood, setNeighbourhood] = useState("");
  const [whereStep, setWhereStep] = useState<WhereStep>("country");

  // event / offline
  const [date, setDate] = useState(""); // YYYY-MM-DD (event date)
  const [offlineMode, setOfflineMode] = useState(false);

  const [eventMode, setEventMode] = useState(false);
  const [eventGenreOptions, setEventGenreOptions] = useState<string[]>([]);
  const [eventCityOptions, setEventCityOptions] = useState<string[]>([]);

 const [tracks, setTracks] = useState<TrackView[]>([]);
  const [pendingFreshRound, setPendingFreshRound] = useState(false);

  // ✅ keep a stable list of genres we've seen so the dropdown never "shrinks"
  const [masterGenres, setMasterGenres] = useState<string[]>([]);

  // Playback
  const [queue, setQueue] = useState<TrackView[]>([]);
  const [nowPlaying, setNowPlaying] = useState<TrackView | null>(null);

  // Autoplay handling
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // UI: overlay / hero
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  // ✅ Splash screen (one-time per session)
  const [splashPhase, setSplashPhase] = useState<"off" | "show" | "fade">("off");

  // mobile detection (simple)
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 860);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ✅ pull filters from URL (share links)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);

    const co = url.searchParams.get("country") ?? "";
    const pr = url.searchParams.get("province") ?? "";
    const ci = url.searchParams.get("city") ?? "";
    const nb = url.searchParams.get("neighbourhood") ?? "";

    const g = url.searchParams.get("genre") ?? "";
    const d = url.searchParams.get("date") ?? "";
    const qq = url.searchParams.get("q") ?? "";
    const off = url.searchParams.get("offline") ?? "";

    if (co) setCountry(co);
    if (pr) setProvince(pr);
    if (ci) setCity(ci);
    if (nb) setNeighbourhood(nb);

    if (g) setGenre(g);
    if (d) setDate(d);
    if (qq) setQ(qq);

    if (off === "1" || off.toLowerCase() === "true") setOfflineMode(true);

    // set whereStep based on deepest param
    if (nb) setWhereStep("neighbourhood");
    else if (ci) setWhereStep("city");
    else if (pr) setWhereStep("province");
    else setWhereStep("country");

    // If any filters exist, don't force the hero overlay forever
    const any = Boolean(co || pr || ci || nb || g || d || qq || off);
    if (any) {
      setFiltersOpen(false);
      setHasStarted(true);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ One-time splash (per session)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const KEY = "sl_splash_seen_v1";
    const already = sessionStorage.getItem(KEY);

    if (already) return;

    sessionStorage.setItem(KEY, "1");

    // timings (tweak these)
    const SHOW_MS = 900; // hold
    const FADE_MS = 3300; // fade duration

    setSplashPhase("show");

    const t1 = window.setTimeout(() => setSplashPhase("fade"), SHOW_MS);
    const t2 = window.setTimeout(() => setSplashPhase("off"), SHOW_MS + FADE_MS + 50);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);


  

  // keep URL in sync (nice for sharing)
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
    setOrDel("neighbourhood", neighbourhood);

    setOrDel("genre", genre);
    setOrDel("date", date);
    setOrDel("q", q);

    if (offlineMode) url.searchParams.set("offline", "1");
    else url.searchParams.delete("offline");

    window.history.replaceState({}, "", url.toString());
  }

  // ============== DATA LOAD ==============
  async function loadTracks() {
    if (offlineMode) {
      setStatus("Offline mode: not refreshing from server.");
      return;
    }

    setStatus("Loading...");

    // ===== EVENT RADIO MODE (when date is chosen) =====
    if (date) {
      setEventMode(true);

      let evQ = supabase
        .from("events")
        .select("id, city, genre, show_date, flyer_path, track_id, created_at")
        .eq("show_date", date)
        .order("created_at", { ascending: false });

      const { data: evs, error: evErr } = await evQ;

      if (evErr) {
        setStatus(`Event load error: ${evErr.message}`);
        setTracks([]);
        setEventGenreOptions([]);
        setEventCityOptions([]);
        return;
      }

      const eventRows = (evs ?? []) as any[];

      // dropdown options from ALL events on that date
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

      // In event mode: require date + city + genre (unchanged from your logic)
      if (!city.trim() || !genre.trim()) {
        setTracks([]);
        setStatus("Pick a date + city + genre to see event radio songs.");
        return;
      }

      const filteredEvents = eventRows.filter((e) => {
        const c = (e.city ?? "").toLowerCase();
        const g = (e.genre ?? "").toLowerCase();
        return c.includes(city.trim().toLowerCase()) && g.includes(genre.trim().toLowerCase());
      });

      const trackIds = filteredEvents.map((e) => e.track_id).filter(Boolean) as string[];

      if (!trackIds.length) {
        setTracks([]);
        setStatus(`No events found for ${date} with ${city} + ${genre}.`);
        return;
      }

      const { data: ts, error: tErr } = await supabase
        .from("tracks")
        .select("id,title,country,province,neighbourhood,city,genre,is_radio,band_slug,file_path,art_path,created_at")
        .in("id", trackIds);

      if (tErr) {
        setStatus(`Tracks load error: ${tErr.message}`);
        setTracks([]);
        return;
      }

      const flyerByTrackId = new Map<string, string | null>();
      for (const e of filteredEvents) {
        if (e.track_id) flyerByTrackId.set(e.track_id, e.flyer_path ?? null);
      }

      const mapped: TrackView[] = (ts ?? []).map((r: TrackRow) => {
        const flyerPath = flyerByTrackId.get(r.id) ?? null;
        const flyerUrl = flyerPath ? withCacheBust(getFlyerUrl(flyerPath)) : "";
        return {
          ...r,
          url: getPublicUrl(r.file_path),
          artUrl: getArtworkUrl(r.art_path),
          flyerUrl,
        };
      });

      setTracks(mapped);
      setStatus(`Event radio for ${date}`);
      return;
    }

    // ===== NORMAL RADIO MODE (no date chosen) =====
    setEventMode(false);
    setEventGenreOptions([]);
    setEventCityOptions([]);

    const { data, error } = await supabase.rpc("radio_pick_one_per_band_filtered", {
      p_country: country || null,
      p_province: province || null,
      p_city: city || null,
      p_neighbourhood: neighbourhood || null,
      p_genre: genre || null,
      p_q: q || null,
    });

    if (error) {
      setStatus(`Load error: ${error.message}`);
      return;
    }

    const mapped: TrackView[] = (data ?? []).map((r: TrackRow) => ({
      ...r,
      url: getPublicUrl(r.file_path),
      artUrl: getArtworkUrl(r.art_path),
      flyerUrl: "",
    }));

    setTracks(mapped);

    // ✅ merge any newly-seen genres into a stable list
    setMasterGenres((prev) => {
      const s = new Set(prev.map((x) => norm(x)).filter(Boolean));
      for (const t of mapped) {
        const g = norm(t.genre);
        if (g) s.add(g);
      }
      return Array.from(s).sort((a, b) => a.localeCompare(b));
    });

    setStatus(mapped.length ? "" : "No radio tracks yet.");
  }

  // ✅ Auto-load when filters change (same as you had)
  useEffect(() => {
    loadTracks();
    syncUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, country, province, city, neighbourhood, genre, q, offlineMode]);

  // ============== OPTIONS ==============
    const genreOptions = useMemo(() => {
    if (date) return ["", ...eventGenreOptions];

    // ✅ use stable list so options don't disappear due to randomness
    const s = new Set(masterGenres.map((x) => norm(x)).filter(Boolean));

    // keep current selection visible (even if not yet in masterGenres)
    const current = norm(genre);
    if (current) s.add(current);

    return ["", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [date, eventGenreOptions, masterGenres, genre]);

  // For event mode, city options are event-based; otherwise we’ll use our hardcoded progressive UI.
  const cityOptions = useMemo(() => {
    if (date) return ["", ...eventCityOptions];
    // In normal mode, we don't need dynamic cityOptions anymore (progressive UI uses hardcoded lists),
    // but we still keep this for any future non-hardcoded expansion.
    const set = new Set<string>();
    for (const t of tracks) {
      const c = norm(t.city);
      if (c) set.add(c);
    }
    return ["", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [date, eventCityOptions, tracks]);

  // ============== FILTERED LIST (IMPORTANT CHANGE) ==============
  // ✅ ANY INPUT yields something:
  // - If user has NO filters, we still return `tracks` (general radio).
  // - If filters exist, we do client-side filtering for display/queue order.
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const co = country.trim().toLowerCase();
    const pr = province.trim().toLowerCase();
    const cc = city.trim().toLowerCase();
    const nb = neighbourhood.trim().toLowerCase();
    const gg = genre.trim().toLowerCase();

    const hasFilter = Boolean(qq || co || pr || cc || nb || gg || date.trim());
    if (!hasFilter) return tracks;

    return tracks.filter((t) => {
      const matchQ = !qq || t.title.toLowerCase().includes(qq) || t.band_slug.toLowerCase().includes(qq);

      const matchCountry = !co || (t.country ?? "").toLowerCase().includes(co);
      const matchProvince = !pr || (t.province ?? "").toLowerCase().includes(pr);
      const matchCity = !cc || (t.city ?? "").toLowerCase().includes(cc);
      const matchNeighbourhood = !nb || (t.neighbourhood ?? "").toLowerCase().includes(nb);
      const matchGenre = !gg || (t.genre ?? "").toLowerCase().includes(gg);

      return matchQ && matchCountry && matchProvince && matchCity && matchNeighbourhood && matchGenre;
    });
  }, [tracks, q, country, province, city, neighbourhood, genre, date]);

  // Build a fresh shuffled queue whenever the filtered list changes
  useEffect(() => {
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
    setQueue(shuffled);

    if (nowPlaying && !shuffled.some((t) => t.id === nowPlaying.id)) {
      setNowPlaying(null);
      setAutoplayBlocked(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  // After a fresh server reload (RPC), auto-start a new round
  useEffect(() => {
    if (!pendingFreshRound) return;
    if (!filtered.length) return;

    const q2 = shuffle(filtered);
    const [next, ...rest] = q2;

    setNowPlaying(next ?? null);
    setQueue(rest);
    setPendingFreshRound(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFreshRound, filtered.length]);

  // Try to start audio whenever nowPlaying changes
  useEffect(() => {
    if (!nowPlaying) return;

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
    // If no tracks match, do nothing
    if (!filtered.length) return;

    // If queue empty, ask server for fresh random set (1 per band)
    if (!queue.length) {
      if (offlineMode) {
        const q2 = shuffle(filtered);
        const [next, ...rest] = q2;
        setNowPlaying(next ?? null);
        setQueue(rest);
        return;
      }

      setPendingFreshRound(true);
      await loadTracks();
      return;
    }

    const [next, ...rest] = queue;
    setNowPlaying(next);
    setQueue(rest);
  }

  function playTrack(t: TrackView) {
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

  // ============== Progressive WHERE handlers ==============
  const prettyBreadcrumb = useMemo(() => {
    const parts = [country, province, city, neighbourhood].map((x) => normSpaces(x)).filter(Boolean);
    return parts;
  }, [country, province, city, neighbourhood]);

  function resetBelow(step: WhereStep) {
    if (step === "country") {
      setProvince("");
      setCity("");
      setNeighbourhood("");
      setWhereStep("country");
      return;
    }
    if (step === "province") {
      setCity("");
      setNeighbourhood("");
      setWhereStep("province");
      return;
    }
    if (step === "city") {
      setNeighbourhood("");
      setWhereStep("city");
      return;
    }
    setWhereStep("neighbourhood");
  }

  function pickCountry(v: string) {
    const clean = toTitleCaseSmart(v);
    setCountry(clean);
    // reset below
    setProvince("");
    setCity("");
    setNeighbourhood("");
    setWhereStep("province");
  }

  function pickProvince(v: string) {
    const clean = toTitleCaseSmart(v);
    setProvince(clean);
    setCity("");
    setNeighbourhood("");
    setWhereStep("city");
  }

  function pickCity(v: string) {
    const clean = toTitleCaseSmart(v);
    setCity(clean);
    setNeighbourhood("");
    setWhereStep("neighbourhood");
  }

  function pickNeighbourhood(v: string) {
    const clean = toTitleCaseSmart(v);
    setNeighbourhood(clean);
    setWhereStep("neighbourhood");
  }

  function openFilters() {
    setFiltersOpen(true);
  }

  function closeFilters() {
    setFiltersOpen(false);
  }

  async function radioLetsGo() {
    setHasStarted(true);
    closeFilters();

    // Ensure we have a queue ready. If user is not offline, refresh from server once.
    if (!offlineMode) {
      await loadTracks();
    }

    // Start playing immediately if nothing playing yet
    if (!nowPlaying) {
      // go() needs queue populated, but queue is set by filtered effect.
      // small tick to let state settle:
      setTimeout(() => {
        go();
      }, 30);
    }
  }

  const overlayTitle = useMemo(() => {
    if (date) return "Event Radio";
    return "Street Level - Radio Tuner";
  }, [date]);

  // =========================
  // RENDER
  // =========================
  const mainMaxWidth = 1000;

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

      {/* ✅ SPLASH SCREEN (one-time per session) */}
      {splashPhase !== "off" ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100000,
            background: "black",
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
            src="/StreetLevelLogo-Punk.jpg"
            alt="StreetLevel"
            style={{
              width: "min(92vw, 860px)",
              height: "auto",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.15)",
              display: "block",
            }}
          />
        </div>
      ) : null}


      {/* ===== HERO: Full screen logo feel ===== */}
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
                height: "auto%",
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
                  disabled={!filtered.length}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    fontWeight: 950,
                    background: "black",
                    color: "#2bff00",
                    opacity: filtered.length ? 1 : 0.45,
                    cursor: filtered.length ? "pointer" : "not-allowed",
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
                    Band Login
                  </Link>
                </div>
              }
            />

            {/* Event mode note */}
            {date ? (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
                Event radio currently uses <b>City + Genre</b> for matching (province/country/neighbourhood don’t exist on
                events yet).
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
    <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 0.7, fontWeight: 900 }}>NOW PLAYING</div>

    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      {/* Title + open band link */}
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 22, fontWeight: 950, lineHeight: 1.1 }}>{nowPlaying.title}</div>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          {(nowPlaying.city || "—")} • {(nowPlaying.genre || "—")} • {(nowPlaying.band_slug || "—")}
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
        </div>
      </div>

      {/* Audio controls (never navigates now) */}
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
              height: 46, // makes the control bar a bit more thumb-friendly on mobile
            }}
            onEnded={onEndedAdvance}
            onPlay={() => setAutoplayBlocked(false)}
          />
        </div>
      ) : null}

      {autoplayBlocked ? (
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Autoplay was blocked by the browser — click <b>Play</b> once to start.
        </div>
      ) : null}

      {(eventMode ? nowPlaying.flyerUrl : nowPlaying.artUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={(eventMode ? nowPlaying.flyerUrl : nowPlaying.artUrl) as string}
          alt="Now playing artwork"
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
    <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 0.7, fontWeight: 900 }}>NOW PLAYING</div>
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
                  <div
                    key={t.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "44px 1fr auto",
                      gap: 10,
                      alignItems: "center",
                      border: "1px solid #eee",
                      borderRadius: 14,
                      padding: "10px 12px",
                    }}
                  >
                    {(() => {
                      const thumb = eventMode ? (t.flyerUrl || t.artUrl) : t.artUrl;

                      return thumb ? (
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
                      );
                    })()}

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
                      onClick={() => playTrack(t)}
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
                ))}
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== FILTER OVERLAY ===== */}
      {filtersOpen ? (
        <div
          onClick={() => {
            // If user already started once, allow click-out to close. Otherwise keep them in it.
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
    width: "min(720px, 96vw)",
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.34)",
    background: "rgba(255,255,255,0.10)", // 👈 translucent
    backdropFilter: "blur(8px)",          // 👈 glass effect (supported browsers)
    WebkitBackdropFilter: "blur(8px)",     // 👈 Safari
    overflow: "hidden",
  }}
>
            <div
              style={{
                padding: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ fontWeight: 950, color: "white", letterSpacing: 0.6 }}>{overlayTitle}</div>

              <div style={{ display: "flex", gap: 8 }}>
                {hasStarted ? (
                  <button
                    onClick={closeFilters}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      background: "black",
                      color: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>

            <div
  style={{
    padding: 14,
    display: "grid",
    gap: 12,

    // ✅ this is the important part:
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  }}
>
              {/* Big logo on top inside overlay (nice on phones) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}


              {/* WHAT / WHERE / WHO */}
              <div style={{ display: "grid", gap: 10 }}>
                {/* WHAT */}
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 950, color: "white", letterSpacing: 0.7 }}>What Genre?:)</div>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    style={{
                      padding: "12px 12px",
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      fontWeight: 800,
                     }}
                  >
                    {(genreOptions.length ? genreOptions : [""]).map((g) => (
                      <option key={g || "any"} value={g}>
                        {g || "Any genre"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* WHERE */}
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 950, color: "white", letterSpacing: 0.7 }}>From Where?:</div>

                  {/* Breadcrumb */}
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
                        const label = p;
                        const isLast = idx === prettyBreadcrumb.length - 1;

                        return (
                          <button
                            key={`${p}-${idx}`}
                            type="button"
                            onClick={() => {
                              // jump back to that step
                              if (idx === 0) resetBelow("country");
                              if (idx === 1) resetBelow("province");
                              if (idx === 2) resetBelow("city");
                              if (idx === 3) resetBelow("neighbourhood");
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
                            {label}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => {
                          setCountry("");
                          setProvince("");
                          setCity("");
                          setNeighbourhood("");
                          setWhereStep("country");
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: "1px solid #ddd",
                          background: "white",
                          color: "black",
                          fontWeight: 900,
                          cursor: "pointer",
                          opacity: 0.8,
                        }}
                        title="Clear location"
                      >
                        Reset
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "white", opacity: 0.65 }}>
                      Optional. Pick country/province/city/neighbourhood… or leave blank.
                    </div>
                  )}

                  {/* Progressive picker */}
                  {whereStep === "country" ? (
                    <select
                      value={country}
                      onChange={(e) => pickCountry(e.target.value)}
                      style={{
                        padding: "12px 12px",
                        borderRadius: 12,
                        border: "1px solid #ddd",
                        fontWeight: 800,
                      }}
                    >
                      <option value="">Any country</option>
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {whereStep === "province" ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <select
                        value={province}
                        onChange={(e) => pickProvince(e.target.value)}
                        style={{
                          padding: "12px 12px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          fontWeight: 800,
                        }}
                      >
                        <option value="">Any province</option>
                        {(PROVINCES_BY_COUNTRY[country || "Canada"] ?? PROVINCES_BY_COUNTRY["Canada"]).map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setWhereStep("country")}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #ddd",
                            background: "black",
                            color: "white",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          ← Back
                        </button>

                        <button
                          type="button"
                          onClick={() => setWhereStep("city")}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #ddd",
                            background: "black",
                            color: "white",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                          title="Skip province and choose a city"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {whereStep === "city" ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <select
                        value={city}
                        onChange={(e) => pickCity(e.target.value)}
                        style={{
                          padding: "12px 12px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          fontWeight: 800,
                        }}
                      >
                        <option value="">Any city</option>
                        {(CITIES_BY_PROVINCE[province] ?? []).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        {/* If province has no seeded cities, still allow event-mode cities */}
                        {!province && !date
                          ? null
                          : null}
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

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setWhereStep(province ? "province" : "country")}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #ddd",
                            background: "black",
                            color: "white",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          ← Back
                        </button>

                        <button
                          type="button"
                          onClick={() => setWhereStep("neighbourhood")}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #ddd",
                            background: "black",
                            color: "white",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                          title="Skip city and choose neighbourhood"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {whereStep === "neighbourhood" ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <select
                        value={neighbourhood}
                        onChange={(e) => pickNeighbourhood(e.target.value)}
                        style={{
                          padding: "12px 12px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          fontWeight: 800,
                        }}
                      >
                        <option value="">Any neighbourhood</option>
                        {(NEIGHBOURHOODS_BY_CITY[city] ?? []).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setWhereStep("city")}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #ddd",
                            background: "black",
                            color: "white",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          ← Back
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            // stay here; user can still GO
                            setWhereStep("neighbourhood");
                          }}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #ddd",
                            background: "black",
                            color: "white",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                          title="Done"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* WHO */}
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 950, color: "white", letterSpacing: 0.7 }}>Who?: search for specific band/song/event:</div>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Band name (or song title)"
                    style={{
                      padding: "12px 12px",
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      fontWeight: 800,
                    }}
                  />
                </div>

                {/* Date + Offline (extras) */}
                <div style={{ display: "grid", gap: 10 }}>
     

                  <label style={{ display: "flex", alignItems: "center", gap: 10, color: "white", fontWeight: 900 }}>
                    <input
                      type="checkbox"
                      checked={offlineMode}
                      onChange={(e) => setOfflineMode(e.target.checked)}
                    />
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
    style={{
      width: "100%",
      padding: "14px 14px",
      borderRadius: 14,
      border: "1px solid #ddd",
      fontWeight: 950,
      background: "black",
      color: "#2bff00",
      cursor: "pointer",
      letterSpacing: 0.6,
    }}
    title="Start the radio with whatever you picked (or nothing!)"
  >
    RADIO LETS GO
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
    </main>
  );
}

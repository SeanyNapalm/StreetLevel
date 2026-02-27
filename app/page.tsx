

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import StreetLevelHeader from "./components/StreetLevelHeader";

type EventRow = {
  id: string;

  // ✅ NEW (events table now stores these)
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

  // EVENT SEARCH (exact show name stored in events.note)
  const [eventShowName, setEventShowName] = useState("");

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

  // ✅ Calendar modal state
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<EventRow[]>([]);

  // ✅ keep a stable list of genres we've seen so the dropdown never "shrinks"
  const [masterGenres, setMasterGenres] = useState<string[]>([]);

  // Playback
  const [queue, setQueue] = useState<TrackView[]>([]);
  const [nowPlaying, setNowPlaying] = useState<TrackView | null>(null);

  // Autoplay handling
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const autoStartAfterEventPickRef = useRef(false);

  // UI: overlay / hero
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  // ✅ Splash screen (one-time per session)
  const [splashPhase, setSplashPhase] = useState<"off" | "show" | "fade">("show");

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
    const evn = url.searchParams.get("event") ?? "";
    const off = url.searchParams.get("offline") ?? "";

    if (co) setCountry(co);
    if (pr) setProvince(pr);
    if (ci) setCity(ci);
    if (nb) setNeighbourhood(nb);

    if (g) setGenre(g);
    if (d) setDate(d);
    if (qq) setQ(qq);
    if (evn) setEventShowName(evn);

    if (off === "1" || off.toLowerCase() === "true") setOfflineMode(true);

    // set whereStep based on deepest param
    if (nb) setWhereStep("neighbourhood");
    else if (ci) setWhereStep("city");
    else if (pr) setWhereStep("province");
    else setWhereStep("country");

    // If any filters exist, don't force the hero overlay forever
    const any = Boolean(co || pr || ci || nb || g || d || qq || evn || off);
    if (any) {
      setFiltersOpen(false);
      setHasStarted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

// ✅ After first load (and after the splash), render the radio UI behind the filters
useEffect(() => {
  if (typeof window === "undefined") return;

  // wait until splash is gone so it still feels clean
  if (splashPhase !== "off") return;

  // show the radio layout behind the modal, but don't autoplay
  setHasStarted(true);

  // make sure we don't accidentally have something playing
  setNowPlaying(null);
  setAutoplayBlocked(false);
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }

  // NOTE: We are NOT calling go() here.
}, [splashPhase]);



  // ✅ One-time splash (per session)
useEffect(() => {
  if (typeof window === "undefined") return;

  const KEY = "sl_splash_seen_v1";
  const already = sessionStorage.getItem(KEY);

  // ✅ If already seen, kill splash immediately (prevents any weird fade)
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

  // ✅ Filter panel sizing (single source of truth)
  const FILTER_PANEL_MAX = 560; // overall modal width cap (shrink this to taste)
  const FILTER_FIELD_MAX = 430; // max width for “main” inputs/selects inside
  const FILTER_GO_MAX = FILTER_FIELD_MAX; // make GO button match field width

  function clearLocation() {
    setCountry("");
    setProvince("");
    setCity("");
    setNeighbourhood("");
    setWhereStep("country");
  }

  function pickEventAndPlay(ev: EventRow) {
    const showName = normSpaces(ev.note ?? "").toUpperCase();
    if (showName) {
      setEventShowName(showName);
      setDate(""); // use show-name mode
    } else {
      // fallback to date mode if note is missing
      setEventShowName("");
      setDate((ev.show_date ?? "").slice(0, 10));
    }

    // ✅ Apply event’s stored location/genre (if present)
    if (ev.country) setCountry(toTitleCaseSmart(ev.country));
    if (ev.province) setProvince(toTitleCaseSmart(ev.province));
    if (ev.city) setCity(toTitleCaseSmart(ev.city));
    if (ev.genre) setGenre(toTitleCaseSmart(ev.genre));

    // ✅ Optional: clear band/song search so event mode feels clean
    setQ("");

    // ✅ Ensure the progressive WHERE UI is at the deepest available level
    if (ev.city) setWhereStep("neighbourhood");
    else if (ev.province) setWhereStep("city");
    else if (ev.country) setWhereStep("province");
    else setWhereStep("country");

    setHasStarted(true);
    setFiltersOpen(false);
    setCalendarOpen(false);

    autoStartAfterEventPickRef.current = true;
  }

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
    setOrDel("event", eventShowName);

    if (offlineMode) url.searchParams.set("offline", "1");
    else url.searchParams.delete("offline");

    window.history.replaceState({}, "", url.toString());
  }

  // ✅ Load calendar events once (upcoming filtering happens client-side)
  async function loadCalendarEvents() {
    setCalendarLoading(true);
    setCalendarError("");

    const today = localTodayISO();

    const { data, error } = await supabase
      .from("events")
      .select("id, country, province, city, genre, show_date, note, flyer_path, track_id, created_at")
      .gte("show_date", today) // ✅ future-only at the DB level
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

      // ✅ upcoming only (today or future)
      if (d < today) return false;

      const evCountry = (ev.country ?? "").toLowerCase();
      const evProvince = (ev.province ?? "").toLowerCase();
      const evCity = (ev.city ?? "").toLowerCase();
      const evGenre = (ev.genre ?? "").toLowerCase();

      // ✅ If user picked a filter, event must match it.
      // Use includes() so “Ottawa” matches “Ottawa (Downtown)” etc.
      const matchCountry = !co || evCountry.includes(co);
      const matchProvince = !pr || evProvince.includes(pr);
      const matchCity = !cc || evCity.includes(cc);
      const matchGenre = !gg || evGenre.includes(gg);

      return matchCountry && matchProvince && matchCity && matchGenre;
    });

    // ✅ De-dupe: if multiple rows share same DATE + EVENT NAME, show it once
    // Keep the first one (your query orders created_at desc, so this keeps the newest row)
    const seen = new Set<string>();
    const unique: EventRow[] = [];

    for (const ev of filteredUpcoming) {
      const d = (ev.show_date ?? "").slice(0, 10);
      const nameKey = normSpaces(ev.note ?? "").toUpperCase();

      // if there is no name, fall back to id so unnamed events don’t collapse together
      const key = nameKey ? `${d}::${nameKey}` : `ID::${ev.id}`;

      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(ev);

      if (unique.length >= 200) break;
    }

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
      // Don’t break the radio if counting fails
      console.warn("ad_share increment failed:", error.message);
    }
  }

  // ============== DATA LOAD ==============
  async function loadTracks(): Promise<TrackView[]> {
    if (offlineMode) {
      setStatus("Offline mode: not refreshing from server.");
      return [];
    }

    setStatus("Loading...");

    // ===== EVENT RADIO MODE (date OR event show-name search) =====
    const cleanEventName = normSpaces(eventShowName || "").toUpperCase();

    if (date || cleanEventName) {
      setEventMode(true);

      let evQ = supabase
        .from("events")
        // include new fields too (safe even if you don't use them here yet)
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
        if (cleanEventName) {
          setStatus(`No songs found for event name: ${cleanEventName}`);
        } else {
          setStatus(`No events found for ${date} with ${city} + ${genre}.`);
        }
        return [];
      }

      const { data: ts, error: tErr } = await supabase
        .from("tracks")
        .select("id,title,country,province,neighbourhood,city,genre,is_radio,band_slug,file_path,art_path,created_at")
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

      // keep genre dropdown stable (event tracks contain genres too)
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

    // ===== NORMAL RADIO MODE (no date & no clean event name) =====
    setEventMode(false);
    setEventGenreOptions([]);
    setEventCityOptions([]);

    const qRaw = q ?? "";
    const qClean = normSpaces(qRaw).trim();
    const qSlug = qClean.replace(/\s+/g, "-"); // "1st show" -> "1st-show"
    const qLower = qClean.toLowerCase();
    const qSlugLower = qSlug.toLowerCase();

  // ✅ BAND MODE: if q matches a band (by band_name/display_name/slug), load ALL tracks for that band
    if (qClean) {
      const qLike = `%${qClean}%`;
      const qSlugGuess = qClean.trim().toLowerCase().replace(/\s+/g, "-"); // "1st show" -> "1st-show"

      // Try band_users first (human-friendly)
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
        .limit(10);

      if (bandErr) {
        console.warn("Band lookup error:", bandErr.message);
      }

      const best = (bands ?? []).find((b) => {
        const bn = (b.band_name ?? "").trim().toLowerCase();
        const dn = (b.display_name ?? "").trim().toLowerCase();
        const qs = qClean.trim().toLowerCase();
        return bn === qs || dn === qs;
      }) ?? (bands?.[0] ?? null);

      const matchedSlug = best?.band_slug?.trim() ?? "";

      if (matchedSlug) {
        const { data: all, error: allErr } = await supabase
          .from("tracks")
          .select(
            "id,title,country,province,neighbourhood,city,genre,is_radio,band_slug,file_path,art_path,created_at"
          )
          .eq("band_slug", matchedSlug)
          .order("created_at", { ascending: false });

        if (allErr) {
          setStatus(`Band tracks load error: ${allErr.message}`);
          setTracks([]);
          return [];
        }

        const mappedAll: TrackView[] = (all ?? []).map((r: TrackRow) => ({
          ...r,
          url: getPublicUrl(r.file_path),
          artUrl: getArtworkUrl(r.art_path),
          flyerUrl: "",
        }));

        setTracks(mappedAll);

        // keep genre dropdown stable
        setMasterGenres((prev) => {
          const s = new Set(prev.map((x) => norm(x)).filter(Boolean));
          for (const t of mappedAll) {
            const g = norm(t.genre);
            if (g) s.add(g);
          }
          return Array.from(s).sort((a, b) => a.localeCompare(b));
        });

        setStatus(`Band mode: ${best?.band_name ?? matchedSlug} • ${mappedAll.length} song(s)`);
        return mappedAll; // ✅ IMPORTANT: don't call the radio RPC
      }
    }

    // ===== NORMAL RADIO MODE (fallback: RPC) =====
    let { data, error } = await supabase.rpc("radio_pick_one_per_band_filtered", {
      p_country: country || null,
      p_province: province || null,
      p_city: city || null,
      p_neighbourhood: neighbourhood || null,
      p_genre: genre || null,
      p_q: qClean || null,
    });

    // retry with slug if empty
    if ((!data || data.length === 0) && qSlug !== qClean && qSlug.length > 0) {
      const retry = await supabase.rpc("radio_pick_one_per_band_filtered", {
        p_country: country || null,
        p_province: province || null,
        p_city: city || null,
        p_neighbourhood: neighbourhood || null,
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

    const mapped: TrackView[] = (data ?? []).map((r: TrackRow) => ({
      ...r,
      url: getPublicUrl(r.file_path),
      artUrl: getArtworkUrl(r.art_path),
      flyerUrl: "",
    }));

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
  }

  // ✅ Auto-load when filters change
  useEffect(() => {
    loadTracks();
    syncUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, country, province, city, neighbourhood, genre, q, eventShowName, offlineMode]);

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

  // ============== FILTERED LIST ==============
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const qqSlug = qq.replace(/\s+/g, "-");
    const co = country.trim().toLowerCase();
    const pr = province.trim().toLowerCase();
    const cc = city.trim().toLowerCase();
    const nb = neighbourhood.trim().toLowerCase();
    const gg = genre.trim().toLowerCase();

    const hasFilter = Boolean(qq || co || pr || cc || nb || gg || date.trim());
    if (!hasFilter) return tracks;

    return tracks.filter((t) => {
      const matchQ =
        !qq ||
        t.title.toLowerCase().includes(qq) ||
        t.band_slug.toLowerCase().includes(qq) ||
        t.band_slug.toLowerCase().includes(qqSlug);

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
    if (!filtered.length) return;

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

    if (!offlineMode) {
      await loadTracks();

      // ✅ Count ONE hit per band for the tracks that were loaded by GO
      setTimeout(() => {
        creditAdShareOnce(filtered);
      }, 0);
    }

    if (!nowPlaying) {
      setTimeout(() => {
        go();
      }, 30);
    }
  }

  const overlayTitle = useMemo(() => {
    if (date) return "Event Radio";
    return "StreetLevel.live";
  }, [date]);

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

                    // glow
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
              {/* ✅ Centered narrow column for ALL controls */}
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
                  <div style={{ fontSize: 12, fontWeight: 950, color: "white", letterSpacing: 0.7 }}>What Genre?:)</div>
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
                  <div style={{ fontSize: 12, fontWeight: 950, color: "white", letterSpacing: 0.7 }}>From Where?:</div>

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
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "white", opacity: 0.65 }}>
                      Optional. Pick country/province/city/neighbourhood… or leave blank.
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
                        disabled={!country && !province && !city && !neighbourhood}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          background: "black",
                          color: "#2bff00",
                          fontWeight: 950,
                          cursor: !country && !province && !city && !neighbourhood ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          opacity: !country && !province && !city && !neighbourhood ? 0.45 : 1,
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
                        disabled={!country && !province && !city && !neighbourhood}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          background: "black",
                          color: "#2bff00",
                          fontWeight: 950,
                          cursor: !country && !province && !city && !neighbourhood ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          opacity: !country && !province && !city && !neighbourhood ? 0.45 : 1,
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
                        disabled={!country && !province && !city && !neighbourhood}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          background: "black",
                          color: "#2bff00",
                          fontWeight: 950,
                          cursor: !country && !province && !city && !neighbourhood ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          opacity: !country && !province && !city && !neighbourhood ? 0.45 : 1,
                        }}
                        title="Clear all location filters"
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}

                  {whereStep === "neighbourhood" ? (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0, maxWidth: FILTER_FIELD_MAX }}>
                        <select
                          value={neighbourhood}
                          onChange={(e) => pickNeighbourhood(e.target.value)}
                          className="sl-select"
                          style={{ width: "100%" }}
                        >
                          <option value="">Any neighbourhood</option>
                          {(NEIGHBOURHOODS_BY_CITY[city] ?? []).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={clearLocation}
                        disabled={!country && !province && !city && !neighbourhood}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          background: "black",
                          color: "#2bff00",
                          fontWeight: 950,
                          cursor: !country && !province && !city && !neighbourhood ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          opacity: !country && !province && !city && !neighbourhood ? 0.45 : 1,
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
                  {/* Event search + Calendar button inline */}
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
                          if (!calendarEvents.length) {
                            await loadCalendarEvents();
                          }
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
                      cursor: "pointer",
                      letterSpacing: 0.6,
                    }}
                    title="Start the radio with whatever you picked (or nothing!)"
                  >
                    RADIO LETS GO!
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

      {/* ===== CALENDAR MODAL (pops over the filterbox) ===== */}
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
                const d = (ev.show_date ?? "").slice(0, 10);
                const name = normSpaces(ev.note ?? "") || "(Unnamed event)";
                const meta = `${ev.city ?? "—"}, ${ev.province ?? "—"}, ${ev.country ?? "—"} • ${ev.genre ?? "—"}`;

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
                    }}
                    title="Pick this event and start playing"
                  >
                    <div style={{ fontWeight: 950 }}>
                      {d} — {name}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>{meta}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

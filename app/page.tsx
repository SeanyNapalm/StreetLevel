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

export default function HomePage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState(""); // Artist or song search

  // ✅ Location filters (top row)
  const [country, setCountry] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [neighbourhood, setNeighbourhood] = useState("");

  // ✅ Second row
  const [date, setDate] = useState(""); // YYYY-MM-DD (event date)
  const [genre, setGenre] = useState(""); // from dropdown
  const [offlineMode, setOfflineMode] = useState(false); // ✅ NEW checkbox

  const [eventMode, setEventMode] = useState(false);
  const [eventGenreOptions, setEventGenreOptions] = useState<string[]>([]);
  const [eventCityOptions, setEventCityOptions] = useState<string[]>([]);

  const [tracks, setTracks] = useState<TrackView[]>([]);
  const [pendingFreshRound, setPendingFreshRound] = useState(false);

  // Playback (shuffled queue — no repeats)
  const [queue, setQueue] = useState<TrackView[]>([]);
  const [nowPlaying, setNowPlaying] = useState<TrackView | null>(null);

  // Autoplay handling
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // ✅ On first load: pull filters from the URL (share links)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


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

async function loadTracks() {
  if (offlineMode) {
    setStatus("Offline mode: not refreshing from server.");
    return;
  }

  setStatus("Loading...");

 // ===== EVENT RADIO MODE (when date is chosen) =====
if (date) {
  setEventMode(true);

  // 1) Always load events for the date FIRST (to populate dropdown options)
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

  // ✅ Build dropdown options from ALL events on that date
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

  // ✅ REQUIRE ALL THREE: date + city + genre (but do NOT kill dropdowns anymore)
  if (!city.trim() || !genre.trim()) {
    setTracks([]);
    setStatus("Pick a date + city + genre to see event radio songs.");
    return;
  }

  // 2) Now filter those date-events by city+genre and collect track_ids
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

  // 3) Load tracks referenced by those filtered events
  const { data: ts, error: tErr } = await supabase
    .from("tracks")
    .select("id,title,country,province,neighbourhood,city,genre,is_radio,band_slug,file_path,art_path,created_at")
    .in("id", trackIds);

  if (tErr) {
    setStatus(`Tracks load error: ${tErr.message}`);
    setTracks([]);
    return;
  }

  // 4) Map track_id -> flyer_path (only from filteredEvents)
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
  setStatus(mapped.length ? "" : "No radio tracks yet.");
}

useEffect(() => {
  loadTracks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [date, country, province, city, neighbourhood, genre, q, offlineMode]);


  // ✅ Dynamic dropdown options based on DB data (from loaded tracks)
 const genreOptions = useMemo(() => {
  if (date) return ["", ...eventGenreOptions];
  const set = new Set<string>();
  for (const t of tracks) {
    const g = norm(t.genre);
    if (g) set.add(g);
  }
  return ["", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
}, [date, eventGenreOptions, tracks]);

// ✅ Location suggestions (from loaded tracks; event mode only has city+genre today)
const countryOptions = useMemo(() => {
  if (date) return [""];
  const set = new Set<string>();
  for (const t of tracks) {
    const v = norm(t.country);
    if (v) set.add(v);
  }
  return ["", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
}, [date, tracks]);

const provinceOptions = useMemo(() => {
  if (date) return [""];
  const set = new Set<string>();
  for (const t of tracks) {
    const v = norm(t.province);
    if (v) set.add(v);
  }
  return ["", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
}, [date, tracks]);

// ✅ City suggestions for an input (better than a dropdown at scale)
const cityOptions = useMemo(() => {
  if (date) return ["", ...eventCityOptions];
  const set = new Set<string>();
  for (const t of tracks) {
    const c = norm(t.city);
    if (c) set.add(c);
  }
  return ["", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
}, [date, eventCityOptions, tracks]);

const neighbourhoodOptions = useMemo(() => {
  if (date) return [""];
  const set = new Set<string>();
  for (const t of tracks) {
    const v = norm(t.neighbourhood);
    if (v) set.add(v);
  }
  return ["", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
}, [date, tracks]);

  // Filtered list: show NOTHING until user enters at least one filter
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const co = country.trim().toLowerCase();
    const pr = province.trim().toLowerCase();
    const cc = city.trim().toLowerCase();
    const nb = neighbourhood.trim().toLowerCase();
    const gg = genre.trim().toLowerCase();

    const hasFilter = Boolean(qq || co || pr || cc || nb || gg);
    if (!hasFilter) return [];

    return tracks.filter((t) => {
      const matchQ =
        !qq ||
        t.title.toLowerCase().includes(qq) ||
        t.band_slug.toLowerCase().includes(qq);

      const matchCountry = !co || (t.country ?? "").toLowerCase().includes(co);
      const matchProvince = !pr || (t.province ?? "").toLowerCase().includes(pr);
      const matchCity = !cc || (t.city ?? "").toLowerCase().includes(cc);
      const matchNeighbourhood = !nb || (t.neighbourhood ?? "").toLowerCase().includes(nb);

      const matchGenre = !gg || (t.genre ?? "").toLowerCase().includes(gg);

      return matchQ && matchCountry && matchProvince && matchCity && matchNeighbourhood && matchGenre;
    });
  }, [tracks, q, country, province, city, neighbourhood, genre]);

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

    // If current song no longer matches the filters, stop it
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


  // Try to start audio whenever nowPlaying changes (best-effort; browser may block)
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

  // Play/Next: pop from queue (no repeats). If queue empty but filters exist, reshuffle a new round.
async function go() {
    if (!filtered.length) return;

    // If we ran out of songs, ask server for a fresh random set (1 per band)
    if (!queue.length) {
      if (offlineMode) {
        // Offline mode: just reshuffle what we already have
        const q2 = shuffle(filtered);
        const [next, ...rest] = q2;
        setNowPlaying(next ?? null);
        setQueue(rest);
        return;
      }

      setPendingFreshRound(true);
      await loadTracks(); // RPC will pick new random per band
      return; // autoplay will happen in the effect below
    }

    // Normal: pop next from queue
    const [next, ...rest] = queue;
    setNowPlaying(next);
    setQueue(rest);
  }

  // Click Play on a row: play that track AND remove it from remaining queue.
  function playTrack(t: TrackView) {
    setQueue((q0) => {
      const idx = q0.findIndex((x) => x.id === t.id);
      if (idx >= 0) {
        const rest = [...q0.slice(0, idx), ...q0.slice(idx + 1)];
        setNowPlaying(t);
        return rest;
      }

      // Edge case: track not in current queue (maybe filters changed). Build new queue excluding it.
      const base = shuffle(filtered).filter((x) => x.id !== t.id);
      setNowPlaying(t);
      return base;
    });
  }

  function onEndedAdvance() {
    go();
  }




  return (
    <main style={{ padding: 44, fontFamily: "sans-serif", maxWidth: 1000, margin: "0 auto" }}>
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
        }
      />

      {/* Controls */}
      <div style={{ display: "grid", gap: 10 }}>
        {/* TOP ROW: Location (4) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
            list="country-options"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
          <datalist id="country-options">
            {countryOptions.filter((x) => x).map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>

          <input
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            placeholder="Province"
            list="province-options"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
          <datalist id="province-options">
            {provinceOptions.filter((x) => x).map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>

          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            list="city-options"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
          <datalist id="city-options">
            {cityOptions.filter((c) => c).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <input
            value={neighbourhood}
            onChange={(e) => setNeighbourhood(e.target.value)}
            placeholder="Neighbourhood"
            list="neighbourhood-options"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
          <datalist id="neighbourhood-options">
            {neighbourhoodOptions.filter((x) => x).map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>

        {/* SECOND ROW: Date / Genre / Search / Offline */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "center" }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />

          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            {genreOptions.map((g) => (
              <option key={g || "any"} value={g}>
                {g || "Any genre"}
              </option>
            ))}
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Artist (or song title)"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap", fontWeight: 900 }}>
            <input
              type="checkbox"
              checked={offlineMode}
              onChange={(e) => setOfflineMode(e.target.checked)}
            />
            Offline mode
          </label>
        </div>

        {date ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Event radio currently uses <b>City + Genre</b> for matching (province/country/neighbourhood don’t exist on events yet).
          </div>
        ) : null}
      </div>

      {/* MAIN LAYOUT: LEFT now playing (only if playing), RIGHT list */}
      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        {/* LEFT: Now Playing */}
        <div>
          {nowPlaying && (
            <Link href={`/b/${nowPlaying.band_slug}`} style={{ textDecoration: "none", color: "inherit" }}>
              <section
                style={{
                  border: "1px solid #eee",
                  borderRadius: 18,
                  padding: 14,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 0.7, fontWeight: 900 }}>
                  NOW PLAYING
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 22, fontWeight: 950, lineHeight: 1.1 }}>{nowPlaying.title}</div>

                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {(nowPlaying.city || "—")} • {(nowPlaying.genre || "—")} • {(nowPlaying.band_slug || "—")}
                  </div>

                  {nowPlaying.url ? (
                    <audio
                      ref={audioRef}
                      key={nowPlaying.id}
                      controls
                      autoPlay
                      src={nowPlaying.url}
                      style={{ width: "100%" }}
                      onEnded={onEndedAdvance}
                      onPlay={() => setAutoplayBlocked(false)}
                    />
                  ) : null}

                  {autoplayBlocked ? (
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      Autoplay was blocked by the browser — click <b>Play</b> on the player once to start.
                    </div>
                  ) : null}

{(eventMode ? nowPlaying.flyerUrl : nowPlaying.artUrl) ? (
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
            </Link>
          )}
        </div>

        {/* RIGHT: List (this is the queue order) */}
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
    </main>
  );
}



"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import StreetLevelHeader from "../../components/StreetLevelHeader";

type TrackRow = {
  id: string;
  title: string;
  city: string;
  genre: string;
  is_radio: boolean;
  band_slug: string;
  file_path: string | null;
  art_path: string | null;
  created_at: string;
  price_cents: number | null; 
};

type TrackView = TrackRow & { url: string; artUrl: string };

type BandUserProfileRow = {
  user_id: string;
  band_slug: string;
  band_name: string | null;
  display_name: string | null;

  country: string | null;
  province: string | null;
  city: string | null;
  genre: string | null;

  bio: string | null;
  avatar_path: string | null;
};

type EventRow = {
  id: string;
  band_slug: string;

  // ✅ new snapshot fields (match radio filters)
  country: string | null;
  province: string | null;


  city: string | null;
  genre: string | null;

  show_date: string; // YYYY-MM-DD
  note: string | null; // show name (events.note)

  flyer_path: string | null;
  track_id: string | null;
  created_at: string;
};


type GalleryItem = {
  name: string;
  path: string;
  url: string;
};

function getPublicUrl(path: string | null) {
  if (!path) return "";
  const res = supabase.storage.from("tracks").getPublicUrl(path);
  return res?.data?.publicUrl ?? "";
}

function getArtworkUrl(path: string | null) {
  if (!path) return "";
  const res = supabase.storage.from("artwork").getPublicUrl(path);
  return res?.data?.publicUrl ?? "";
}

function getAvatarUrl(path: string | null) {
  if (!path) return "";
  const res = supabase.storage.from("avatars").getPublicUrl(path);
  return res?.data?.publicUrl ?? "";
}

function getFlyerUrl(path: string | null) {
  if (!path) return "";
  const res = supabase.storage.from("flyers").getPublicUrl(path);
  return res?.data?.publicUrl ?? "";
}

function getGalleryUrl(path: string | null) {
  if (!path) return "";
  const res = supabase.storage.from("band-gallery").getPublicUrl(path);
  return res?.data?.publicUrl ?? "";
}

function withCacheBust(url: string) {
  if (!url) return "";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${Date.now()}`;
}

function prettyFromSlug(slug: string) {
  if (!slug) return "";
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function norm(s: string | null | undefined) {
  return (s ?? "").trim();
}

function normSpaces(s: string | null | undefined) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function toUpperEventName(s: string | null | undefined) {
  return normSpaces(s).toUpperCase();
}

function buildEventLink(ev: EventRow) {
  // Prefer exact event name mode (/?event=NAME) because it’s the cleanest UX
  const name = toUpperEventName(ev.note);

  // Use the live site origin when deployed, localhost when local
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (name) {
    return `${origin}/?event=${encodeURIComponent(name)}`;
  }

  // Fallback: date-mode link (works with your radio page logic)
  const d = (ev.show_date ?? "").slice(0, 10);

  const params = new URLSearchParams();
  if (d) params.set("date", d);
  if (norm(ev.city)) params.set("city", norm(ev.city));
  if (norm(ev.genre)) params.set("genre", norm(ev.genre));

  return `${origin}/?${params.toString()}`;
}

function prettyEventWhere(ev: EventRow) {
  // country / province / city  (only show what exists)
const parts = [ev.country, ev.province, ev.city]
  .map((x) => norm(x))
  .filter(Boolean);

  return parts.length ? parts.join(" • ") : "—";
}


export default function PublicBandPage({
  params,
}: {
  params: Promise<{ band: string }>;
}) {

async function creditBandPageHitOnce(slug: string) {
  const clean = (slug ?? "").trim().toLowerCase();
  if (!clean) return;

  // ✅ prevent double-count (dev StrictMode) + spam refresh (same tab)
  const key = `sl_band_hit_v1:${clean}`;
  if (typeof window !== "undefined") {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  }

  const { error } = await supabase.rpc("increment_ad_share_for_band_slugs", {
    p_band_slugs: [clean],
  });

  if (error) {
    // don't break page load
    console.warn("band page hit increment failed:", error.message);
  }
}

async function buyTrack(track: TrackView) {
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: track.id }),
    });

    const data = await res.json();

    if (data?.url) {
      window.location.href = data.url; // Stripe Checkout
    } else {
      alert("Checkout failed to start.");
    }
  } catch (e) {
    console.error(e);
    alert("Network error starting checkout.");
  }
}

  const { band: bandSlugRaw } = use(params);
  const bandSlug = (bandSlugRaw ?? "").trim();

  const [status, setStatus] = useState("");

  const [tracks, setTracks] = useState<TrackView[]>([]);
  const [profile, setProfile] = useState<BandUserProfileRow | null>(null);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [copiedEventId, setCopiedEventId] = useState<string>("");

  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };
  const closeLightbox = () => setLightboxOpen(false);
  const prevPhoto = () =>
    setLightboxIndex((i) => (i - 1 + gallery.length) % gallery.length);
  const nextPhoto = () =>
    setLightboxIndex((i) => (i + 1) % gallery.length);

  const activePhoto = gallery[lightboxIndex];

  const prettyBand = useMemo(
    () =>
      profile?.display_name ||
      profile?.band_name ||
      prettyFromSlug(bandSlug) ||
      bandSlug ||
      "Band",
    [bandSlug, profile?.display_name, profile?.band_name]
  );

  const avatarUrl = useMemo(
    () => withCacheBust(getAvatarUrl(profile?.avatar_path ?? null)),
    [profile?.avatar_path]
  );

  async function loadProfile() {
    if (!bandSlug) return;

    const { data, error } = await supabase
      .from("band_users")
.select(
  "user_id, band_slug, band_name, display_name, country, province, city, genre, bio, avatar_path"
)
      .eq("band_slug", bandSlug)
      .order("user_id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) return;
    setProfile((data as any) ?? null);
  }

  async function loadBandTracks() {
    if (!bandSlug) {
      setTracks([]);
      setStatus("Missing band in URL.");
      return;
    }

    setStatus("Loading...");
const { data, error } = await supabase
  .from("tracks")
  .select("id,title,city,genre,is_radio,band_slug,file_path,art_path,price_cents,created_at") // ✅ add price_cents
  .eq("band_slug", bandSlug)
  .order("created_at", { ascending: false })
  .order("id", { ascending: false });

    if (error) {
      setTracks([]);
      setStatus(`Load error: ${error.message}`);
      return;
    }

    const mapped: TrackView[] = (data ?? []).map((r: TrackRow) => ({
      ...r,
      url: getPublicUrl(r.file_path),
      artUrl: getArtworkUrl(r.art_path),
    }));

    setTracks(mapped);
    setStatus(mapped.length ? "" : "No tracks yet.");
  }

  async function loadUpcomingShows() {
    if (!bandSlug) return;

    setEventsLoading(true);

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const { data, error } = await supabase
      .from("events")
.select(
  "id,band_slug,country,province,city,genre,show_date,note,flyer_path,track_id,created_at"
)
      .eq("band_slug", bandSlug)
      .gte("show_date", todayStr)
      .order("show_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      setEvents([]);
      setEventsLoading(false);
      return;
    }

    setEvents((data ?? []) as EventRow[]);
    setEventsLoading(false);
  }

  // ✅ FIXED: list from bandSlug/bandSlug (matches your bucket screenshot)
  async function loadGalleryPublic() {

    if (!bandSlug) return;

    setGalleryLoading(true);
    try {
const uid = profile?.user_id;
if (!uid) return;

const folder = `${uid}/${bandSlug}`;

const { data, error } = await supabase.storage
  .from("band-gallery")
  .list(folder, {
    limit: 50,
    offset: 0,
    sortBy: { column: "created_at", order: "desc" },
  });

      if (error) throw error;

      const items: GalleryItem[] = (data ?? [])
        .filter((x) => x.name && x.name !== ".emptyFolderPlaceholder")
        .map((x) => {
          const path = `${folder}/${x.name}`;
          return {
            name: x.name,
            path,
            url: withCacheBust(getGalleryUrl(path)),
          };
        });

      setGallery(items);
    } catch {
      setGallery([]);
    } finally {
      setGalleryLoading(false);
    }
  }

  // Keyboard controls for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prevPhoto();
      if (e.key === "ArrowRight") nextPhoto();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, gallery.length]);

useEffect(() => {
  loadProfile();
  loadBandTracks();
  loadUpcomingShows();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [bandSlug]);

useEffect(() => {
  if (!profile?.user_id) return;
  loadGalleryPublic();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [profile?.user_id, bandSlug]);

useEffect(() => {
  if (!bandSlug) return;

  // ✅ count a band "view hit" once per tab/session
  creditBandPageHitOnce(bandSlug);

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [bandSlug]);

  return (
    <main
      style={{
        padding: 18,
        fontFamily: "sans-serif",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <StreetLevelHeader
        left={
          <Link
            href="/"
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
            ← Back to Radio
          </Link>
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

      {/* TITLE */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginTop: 6,
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 950, lineHeight: 1 }}>
          {prettyBand}
        </div>
        <div style={{ opacity: 0.7, fontWeight: 800 }}>
          {tracks.length} track{tracks.length === 1 ? "" : "s"}
        </div>
      </div>

      {status ? <div style={{ marginTop: 10, opacity: 0.8 }}>{status}</div> : null}

      {/* ===== TOP ROW: BIO (left) + TRACKS (right) ===== */}
      {/* ===== VERTICAL STACK ===== */}
      <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
        {/* BIO */}
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 18,
            padding: 14,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 950, letterSpacing: 0.7 }}>ABOUT</div>

          <div
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: 18,
              border: "1px solid #eee",
              overflow: "hidden",
              background: "#f6f6f6",
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="band avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  opacity: 0.65,
                }}
              >
                No pic
              </div>
            )}
          </div>

          <div style={{ fontWeight: 950, fontSize: 18 }}>{prettyBand}</div>

<div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
  {(() => {
    const g = norm(profile?.genre);
    const city = norm(profile?.city);
    const prov = norm(profile?.province);
    const country = norm(profile?.country);

    const where = [city, prov, country].filter(Boolean).join(", ");

    if (!g && !where) return "Location not set";
    if (!g) return where;
    if (!where) return g;

    return `${g} — ${where}`;
  })()}
</div>



          <div
            style={{
              fontSize: 13,
              opacity: 0.85,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
            }}
          >
            {(profile?.bio ?? "").trim() ? profile?.bio : "No bio yet."}
          </div>

          {/* PHOTOS */}
          <div style={{ fontWeight: 950, letterSpacing: 0.7, marginTop: 6 }}>
            PHOTOS
          </div>

          {galleryLoading ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>Loading photos…</div>
          ) : gallery.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {gallery.slice(0, 9).map((g, idx) => (
                <button
                  key={g.path}
                  onClick={() => openLightbox(idx)}
                  style={{
                    display: "block",
                    borderRadius: 14,
                    overflow: "hidden",
                    border: "1px solid #eee",
                    background: "#f6f6f6",
                    padding: 0,
                    cursor: "pointer",
                  }}
                  title={g.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.url}
                    alt={g.name}
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>No photos yet.</div>
          )}
        </section>

        {/* TRACKS */}
        <section>
          <div
            style={{
              fontWeight: 950,
              letterSpacing: 0.7,
              marginBottom: 10,
              padding: "12px 14px",
              borderRadius: 14,
              background: "black",
              color: "#2bff00",
            }}
          >
            TRACKS
          </div>

<div style={{ display: "grid", gap: 10 }}>
  {tracks.map((t) => {
    // ✅ compute price label per track
    const priceCents = Number((t as any).price_cents ?? 100); // default $1.00
    const priceLabel = `$${(priceCents / 100).toFixed(2)}`;

    return (
      <div
        key={t.id}
        style={{
          border: "1px solid #eee",
          borderRadius: 14,
          padding: 12,
          display: "grid",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            minWidth: 0,
          }}
        >
          {t.artUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.artUrl}
              alt="artwork"
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                objectFit: "cover",
                border: "1px solid #eee",
                flex: "0 0 auto",
              }}
            />
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                border: "1px solid #eee",
                opacity: 0.35,
                flex: "0 0 auto",
              }}
            />
          )}

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 950,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {t.title || "Untitled"}
            </div>
            <div
              style={{
                fontSize: 12,
                opacity: 0.75,
                marginTop: 4,
              }}
            >
              {(t.city || "—")} • {(t.genre || "—")}
            </div>
          </div>
        </div>

        {t.url ? (
          <audio controls src={t.url} style={{ width: "100%" }} />
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Audio missing (file_path not set)
          </div>
        )}



        {/* BUY BUTTON */}
        <button
          onClick={() => buyTrack(t)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #000",
            background: "black",
            color: "#2bff00",
            fontWeight: 900,
            cursor: "pointer",
            width: "fit-content",
          }}
          title="Buy this track"
        >
          Buy track • {priceLabel}
        </button>

        <div style={{ fontSize: 12, opacity: 0.6 }}>
          Purchases coming next — this button will launch checkout.
        </div>
      </div>
    );
  })}
</div>
        </section>
      </div>




      {/* ===== MORE VERTICAL STACK ===== */}
      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        {/* UPCOMING SHOWS */}
        <section>
          <div
            style={{
              fontWeight: 950,
              letterSpacing: 0.7,
              marginBottom: 10,
              padding: "12px 14px",
              borderRadius: 14,
              background: "#000",
              color: "#2bff00",
            }}
          >
            UPCOMING SHOWS
          </div>

          {eventsLoading ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>Loading…</div>
          ) : events.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {events.slice(0, 10).map((ev) => {
                const flyer = ev.flyer_path ? withCacheBust(getFlyerUrl(ev.flyer_path)) : "";
                const trackTitle =
                  (ev.track_id && tracks.find((t) => t.id === ev.track_id)?.title) || "—";

return (
  <div
    key={ev.id}
    style={{
      display: "grid",
      gridTemplateColumns: "64px 1fr auto",
      gap: 10,
      alignItems: "center",
      border: "1px solid #eee",
      borderRadius: 14,
      padding: 10,
    }}
  >
    {flyer ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={flyer}
        alt="flyer"
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          objectFit: "cover",
          border: "1px solid #eee",
        }}
      />
    ) : (
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          border: "1px solid #eee",
          opacity: 0.35,
        }}
      />
    )}

    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 950 }}>
        {(ev.show_date ?? "").slice(0, 10)} — {normSpaces(ev.note) || "(Unnamed event)"}
      </div>

      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
        {prettyEventWhere(ev)} • {(ev.genre ?? "—")}
      </div>

      <div
        style={{
          fontSize: 12,
          opacity: 0.75,
          marginTop: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={trackTitle}
      >
        Chosen Song: <b>{trackTitle}</b>
      </div>

      {/* ✅ clickable event link */}
      <div style={{ marginTop: 8 }}>
        <a
          href={buildEventLink(ev)}
          style={{
            fontSize: 12,
            fontWeight: 900,
            textDecoration: "underline",
            color: "black",
            wordBreak: "break-all",
          }}
          title="Open this event radio link"
        >
          {buildEventLink(ev)}
        </a>
      </div>
    </div>

    {/* ✅ Copy link button */}
    <button
      type="button"
      onClick={async () => {
        const link = buildEventLink(ev);
        try {
          await navigator.clipboard.writeText(link);
          setCopiedEventId(ev.id);
          window.setTimeout(() => setCopiedEventId(""), 1200);
        } catch {
          // fallback if clipboard API is blocked
          window.prompt("Copy this link:", link);
        }
      }}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #000",
        background: "black",
        color: "#2bff00",
        fontWeight: 900,
        cursor: "pointer",
        whiteSpace: "nowrap",
        height: "fit-content",
      }}
      title="Copy event link"
    >
      {copiedEventId === ev.id ? "Copied!" : "Copy link"}
    </button>
  </div>
);
              })}

              {events.length > 10 ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Showing next 10 (you have {events.length}).
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              No upcoming shows posted yet.
            </div>
          )}
        </section>

        {/* MERCH */}
        <section>
          <div
            style={{
              fontWeight: 950,
              letterSpacing: 0.7,
              marginBottom: 10,
              padding: "12px 14px",
              borderRadius: 14,
              background: "#eee",
              color: "black",
            }}
          >
            MERCH
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
            <div style={{ fontWeight: 950 }}>Coming soon</div>
            <div style={{ opacity: 0.75, marginTop: 6 }}>
              This is where shirts/tapes/vinyl will appear. We’ll wire this to a merch
              table next.
            </div>
          </div>
        </section>
      </div>

      {/* LIGHTBOX MODAL */}
      {lightboxOpen && activePhoto ? (
        <div
          onClick={closeLightbox}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 18,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(980px, 96vw)",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(0,0,0,0.35)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 10,
                gap: 10,
              }}
            >
              <div style={{ color: "white", fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
                {lightboxIndex + 1}/{gallery.length}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={prevPhoto}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.25)",
                    background: "black",
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  ←
                </button>
                <button
                  onClick={nextPhoto}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.25)",
                    background: "black",
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  →
                </button>
                <button
                  onClick={closeLightbox}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
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
            </div>

            <div style={{ background: "black" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhoto.url}
                alt={activePhoto.name}
                style={{
                  width: "100%",
                  maxHeight: "78vh",
                  objectFit: "contain",
                  display: "block",
                  background: "black",
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}


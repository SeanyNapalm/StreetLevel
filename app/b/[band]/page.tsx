"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import StreetLevelHeader from "../../components/StreetLevelHeader";
import { formatShowDate } from "../../../lib/date";




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

async function downloadTrackFile(track: TrackView) {
  if (!track.url) {
    alert("This track has no audio file yet.");
    return;
  }

  const response = await fetch(track.url);
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const ext =
    track.url.toLowerCase().includes(".wav") ? "wav" :
    track.url.toLowerCase().includes(".flac") ? "flac" :
    track.url.toLowerCase().includes(".m4a") ? "m4a" :
    track.url.toLowerCase().includes(".aac") ? "aac" :
    "mp3";

  const safeName = (track.title || "track").replace(/[\\/:*?"<>|]/g, "_");

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${safeName}.${ext}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(objectUrl);
}

async function buyTrack(track: TrackView) {
  try {
    const priceCents = Number(track.price_cents ?? 100);

    const { data: authData } = await supabase.auth.getSession();
    const uid = authData.session?.user?.id ?? "";

    if (!uid) {
      alert("Please log in first.");
      return;
    }

    if (!track.url) {
      alert("This track has no audio file yet.");
      return;
    }

    // already owned = no charge, just download again
    if (ownedIds.has(track.id)) {
      if (downloadToFiles) {
        await downloadTrackFile(track);
      }

      if (downloadToOffline) {
        console.log("TODO: save owned track in StreetLevel offline storage", {
          trackId: track.id,
          title: track.title,
          url: track.url,
        });
      }

      window.setTimeout(() => {
        showNotice(
          "success",
          "Already owned",
          `"${track.title || "Untitled"}" downloaded again.`
        );
      }, 800);

      return;
    }

    if (streetCredCents < priceCents) {
      showNotice(
        "error",
        "Not enough Street Cred",
        `Track price: $${(priceCents / 100).toFixed(2)}\nYour balance: $${(
          streetCredCents / 100
        ).toFixed(2)}`
      );
      return;
    }

    const newBalance = streetCredCents - priceCents;

    const { error: updateError } = await supabase
      .from("streetcred")
      .update({ balance_cents: newBalance })
      .eq("user_id", uid);

    if (updateError) {
      alert(`Street Cred update failed: ${updateError.message}`);
      return;
    }

    const { error: purchaseError } = await supabase
      .from("purchases")
      .insert({
        user_id: uid,
        track_id: track.id,
        price_cents: priceCents,
      });

    if (purchaseError) {
      alert(`Purchase record failed: ${purchaseError.message}`);
      return;
    }

    setStreetCredCents(newBalance);
    setOwnedIds((prev) => {
      const next = new Set(prev);
      next.add(track.id);
      return next;
    });

    if (downloadToFiles) {
      try {
        await downloadTrackFile(track);
      } catch (err) {
        console.error("File download failed:", err);
        alert("The track was purchased, but the file download failed.");
      }
    }

    if (downloadToOffline) {
      console.log("TODO: save in StreetLevel offline storage", {
        trackId: track.id,
        title: track.title,
        url: track.url,
      });
    }

    window.setTimeout(() => {
      showNotice(
        "success",
        "Track purchased",
        `"${track.title || "Untitled"}" downloaded.\nNew Street Cred balance: $${(
          newBalance / 100
        ).toFixed(2)}`
      );
    }, 1200);
  } catch (e) {
    console.error(e);
    showNotice("error", "Purchase failed", "Something went wrong.");
  }
}
function openDownloadOptions(track: TrackView) {
  setDownloadTrack(track);
  setDownloadToFiles(true);
  setDownloadToOffline(true);
  setDownloadOptionsOpen(true);
}


function showNotice(
  type: "success" | "error",
  title: string,
  message: string
) {
  setNotice({ type, title, message });

  window.setTimeout(() => {
    setNotice((current) =>
      current?.title === title && current?.message === message ? null : current
    );
  }, 3200);
}

async function continueWithDownloadOptions() {
  if (!downloadTrack) return;

  if (!downloadToFiles && !downloadToOffline) {
    alert("Pick at least one option before continuing.");
    return;
  }

  setDownloadOptionsOpen(false);

  await buyTrack(downloadTrack);
}


  const { band: bandSlugRaw } = use(params);
  const bandSlug = (bandSlugRaw ?? "").trim();

  const [status, setStatus] = useState("");

// ✅ logged-in user (optional) + banned track ids for this user
const [userId, setUserId] = useState<string>("");
const [bannedIds, setBannedIds] = useState<Set<string>>(new Set());

const [streetCredCents, setStreetCredCents] = useState<number>(0);
const [streetCredLoading, setStreetCredLoading] = useState<boolean>(true);
const [buyingCred, setBuyingCred] = useState(false);


const [downloadOptionsOpen, setDownloadOptionsOpen] = useState(false);
const [downloadTrack, setDownloadTrack] = useState<TrackView | null>(null);
const [downloadToFiles, setDownloadToFiles] = useState(true);
const [downloadToOffline, setDownloadToOffline] = useState(true);

const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());

const [notice, setNotice] = useState<{
  type: "success" | "error";
  title: string;
  message: string;
} | null>(null);

async function loadMyBans() {
  // user might not be logged in — that's fine
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id ?? "";
  setUserId(uid);

  if (!uid) {
    setBannedIds(new Set());
    return;
  }

  const { data: bans, error } = await supabase
    .from("user_banned_tracks")
    .select("track_id")
    .eq("user_id", uid);

  if (error) {
    console.warn("loadMyBans error:", error.message);
    setBannedIds(new Set());
    return;
  }

  const s = new Set<string>((bans ?? []).map((b: any) => String(b.track_id)));
  setBannedIds(s);
}



async function loadMyStreetCred() {
  setStreetCredLoading(true);

  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id ?? "";

  if (!uid) {
    setStreetCredCents(0);
    setStreetCredLoading(false);
    return;
  }

  const { data: row, error } = await supabase
    .from("streetcred")
    .select("balance_cents")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    console.warn("loadMyStreetCred error:", error.message);
    setStreetCredCents(0);
    setStreetCredLoading(false);
    return;
  }

  setStreetCredCents(Number(row?.balance_cents ?? 0));
  setStreetCredLoading(false);
}


async function loadMyPurchases() {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id ?? "";

  if (!uid) {
    setOwnedIds(new Set());
    return;
  }

  const { data: rows, error } = await supabase
    .from("purchases")
    .select("track_id")
    .eq("user_id", uid);

  if (error) {
    console.warn("loadMyPurchases error:", error.message);
    setOwnedIds(new Set());
    return;
  }

  setOwnedIds(new Set((rows ?? []).map((r: any) => String(r.track_id))));
}

async function buyStreetCred(amountDollars: 5 | 10 | 20) {
  try {
    setBuyingCred(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw new Error(userError.message);
    }

    if (!user?.id) {
      alert("Please log in first.");
      return;
    }

    const res = await fetch("/api/create-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
body: JSON.stringify({
  amountDollars,
  bandSlug,
  userId: user.id,
  returnTo: `/b/${bandSlug}`,
}),
    });

    const data = await res.json();

    if (!res.ok || !data?.url) {
      throw new Error(data?.error || "Could not create checkout session.");
    }

    window.location.href = data.url;
  } catch (e: any) {
    alert(`Buy credits failed: ${e?.message ?? String(e)}`);
  } finally {
    setBuyingCred(false);
  }
}

async function confirmAndBuyStreetCred(amountDollars: 5 | 10 | 20) {
  const checkoutTotals: Record<5 | 10 | 20, string> = {
    5: "5.72",
    10: "10.98",
    20: "21.49",
  };

  const streetLevelFees: Record<5 | 10 | 20, string> = {
    5: "0.25",
    10: "0.50",
    20: "1.00",
  };

  const stripeFees: Record<5 | 10 | 20, string> = {
    5: "0.47",
    10: "0.48",
    20: "0.49",
  };

  const ok = window.confirm(
    `To give you $${amountDollars.toFixed(2)} Street Cred, the total charge is $${checkoutTotals[amountDollars]}.\n\n` +
    `Why?\n` +
    `• $${amountDollars.toFixed(2)} = your Street Cred balance\n` +
    `• $${streetLevelFees[amountDollars]} = StreetLevel fee\n` +
    `• $${stripeFees[amountDollars]} = Stripe fee\n\n` +
    `That means you pay $${checkoutTotals[amountDollars]} total to receive $${amountDollars.toFixed(2)} in usable credits.\n\n` +
    `Press OK to continue to checkout.`
  );

  if (!ok) return;

  await buyStreetCred(amountDollars);
}



async function undoBan(trackId: string) {
  if (!userId) return;

  // ✅ optimistic UI
  setBannedIds((prev) => {
    const next = new Set(prev);
    next.delete(trackId);
    return next;
  });

  const { error } = await supabase
    .from("user_banned_tracks")
    .delete()
    .eq("user_id", userId)
    .eq("track_id", trackId);

  if (error) {
    console.warn("undoBan error:", error.message);

    // rollback on failure
    setBannedIds((prev) => {
      const next = new Set(prev);
      next.add(trackId);
      return next;
    });
  }
}

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

  // ✅ load bans for logged-in user (if any)
  loadMyBans();
  loadMyStreetCred();
  loadMyPurchases();



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
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
    padding: "12px 14px",
    borderRadius: 14,
    background: "black",
    color: "#2bff00",
    flexWrap: "wrap",
  }}
>
  <div
    style={{
      fontWeight: 950,
      letterSpacing: 0.7,
    }}
  >
    TRACKS
  </div>

  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    }}
  >
<div
  style={{
    fontWeight: 900,
    fontSize: 14,
    whiteSpace: "nowrap",
    color: "white",
    letterSpacing: 0.4,
  }}
  title="Your Street Cred balance"
>
  Your Street Cred:{" "}
  <span style={{ fontWeight: 950 }}>
    {streetCredLoading ? "Loading..." : `$${(streetCredCents / 100).toFixed(2)}`}
  </span>
</div>

    <button
      onClick={() => confirmAndBuyStreetCred(5)}
      disabled={buyingCred}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid rgba(43,255,0,0.4)",
        background: "rgba(0,0,0,0.6)",
        color: "#2bff00",
        fontWeight: 900,
        cursor: buyingCred ? "not-allowed" : "pointer",
        opacity: buyingCred ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
      title="Add $5 Street Cred"
    >
      {buyingCred ? "Working..." : "+$5"}
    </button>

    <button
      onClick={() => confirmAndBuyStreetCred(10)}
      disabled={buyingCred}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid rgba(43,255,0,0.4)",
        background: "rgba(0,0,0,0.6)",
        color: "#2bff00",
        fontWeight: 900,
        cursor: buyingCred ? "not-allowed" : "pointer",
        opacity: buyingCred ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
      title="Add $10 Street Cred"
    >
      {buyingCred ? "Working..." : "+$10"}
    </button>

    <button
      onClick={() => confirmAndBuyStreetCred(20)}
      disabled={buyingCred}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid rgba(43,255,0,0.4)",
        background: "rgba(0,0,0,0.6)",
        color: "#2bff00",
        fontWeight: 900,
        cursor: buyingCred ? "not-allowed" : "pointer",
        opacity: buyingCred ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
      title="Add $20 Street Cred"
    >
      {buyingCred ? "Working..." : "+$20"}
    </button>
  </div>
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


{/* BUY + STREET CRED + (optional) UNDO BAN */}
<div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
<button
  onClick={() => openDownloadOptions(t)}
  style={{
    padding: "10px 12px",
    borderRadius: 10,
    border: ownedIds.has(t.id) ? "1px solid #0a7f00" : "1px solid #000",
    background: ownedIds.has(t.id) ? "#eaffea" : "black",
    color: ownedIds.has(t.id) ? "#0a7f00" : "#2bff00",
    fontWeight: 950,
    cursor: "pointer",
    width: "fit-content",
  }}
  title={ownedIds.has(t.id) ? "You already own this track" : "Buy this track"}
>
  {ownedIds.has(t.id) ? "Owned ✓" : `Buy track • ${priceLabel}`}
</button>



  {bannedIds.has(t.id) ? (
    <button
      onClick={() => undoBan(t.id)}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(43,255,0,0.35)",
        background: "rgba(0,0,0,0.85)",
        color: "red",
        fontWeight: 950,
        cursor: "pointer",
        width: "fit-content",
      }}
      title="Undo ban for this track"
    >
      Lift Song Ban?
    </button>
  ) : null}
</div>

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
        {formatShowDate(ev.show_date, { weekday: true })} — {normSpaces(ev.note) || "(Unnamed event)"}
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


            {downloadOptionsOpen && downloadTrack ? (
        <div
          onClick={() => setDownloadOptionsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 9998,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(620px, 100%)",
              background: "white",
              borderRadius: 18,
              border: "1px solid #ddd",
              padding: 20,
              display: "grid",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 950, lineHeight: 1.1 }}>
                Download Options
              </div>

              <button
                type="button"
                onClick={() => setDownloadOptionsOpen(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  background: "black",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div style={{ fontSize: 15, lineHeight: 1.6 }}>
              You are about to buy <b>{downloadTrack.title || "Untitled"}</b>.
              <br />
              Choose where you want it saved after purchase:
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 14,
                cursor: "pointer",
                background: "#fafafa",
              }}
            >
              <input
                type="checkbox"
                checked={downloadToFiles}
                onChange={(e) => setDownloadToFiles(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 950 }}>Download to Files</div>
                <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                  Save the music file to the user’s device so they own a downloadable copy.
                </div>
              </div>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 14,
                cursor: "pointer",
                background: "#fafafa",
              }}
            >
              <input
                type="checkbox"
                checked={downloadToOffline}
                onChange={(e) => setDownloadToOffline(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 950 }}>Save in StreetLevel for offline</div>
                <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                  Keep a copy in StreetLevel app storage so it can play later without internet.
                </div>
              </div>
            </label>

            <div
              style={{
                fontSize: 13,
                opacity: 0.75,
                lineHeight: 1.5,
                border: "1px solid #eee",
                borderRadius: 14,
                padding: 12,
                background: "#fafafa",
              }}
            >
              For now, this popup saves the user’s choices before continuing.
              Next we’ll wire those choices into real file download and real offline storage.
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setDownloadOptionsOpen(false)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  background: "white",
                  color: "black",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={continueWithDownloadOptions}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #000",
                  background: "black",
                  color: "#2bff00",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}


      {notice ? (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 10000,
            width: "min(420px, calc(100vw - 32px))",
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 18,
            boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
            padding: 16,
            display: "grid",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 950,
              color: notice.type === "success" ? "#0a7f00" : "#cc0000",
              lineHeight: 1.1,
            }}
          >
            {notice.title}
          </div>

          <div
            style={{
              fontSize: 15,
              lineHeight: 1.5,
              whiteSpace: "pre-line",
            }}
          >
            {notice.message}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setNotice(null)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #000",
                background: "black",
                color: "#2bff00",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

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


"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import StreetLevelHeader from "../../components/StreetLevelHeader";

type EventRow = {
  id: string;
  band_slug: string;
  city: string;
  genre: string;
  show_date: string;
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

  // keep genre on the track for now
  genre: string;

  is_radio: boolean;
  band_slug: string;
  file_path: string | null;
  art_path: string | null;
  created_at: string;
  price_cents: number;
};

type TrackView = TrackRow & { url: string; artUrl: string };

type BandUserProfileRow = {
  user_id: string;
  band_slug: string;
  band_name: string | null;
  display_name: string | null;

  country: string | null;
  province: string | null;
  neighbourhood: string | null;

  city: string | null;
  bio: string | null;
  avatar_path: string | null;
};

type GalleryItem = {
  path: string;
  name: string;
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

// ---------- Normalization helpers ----------
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

function safeFileName(name: string) {
  return (name || "file").replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export default function BandDashboard({
  params,
}: {
  params: Promise<{ band: string }>;
}) {
  const router = useRouter();
  const p = use(params);
  const bandSlug = (p?.band ?? "").trim();

  const [displayName, setDisplayName] = useState("");
  const [tracks, setTracks] = useState<TrackView[]>([]);
  const [status, setStatus] = useState<string>("");
  const [eventStatus, setEventStatus] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // Track editing (ONLY: title, price, radio, artwork)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editGenre, setEditGenre] = useState(""); // ✅ NEW
  const [editRadio, setEditRadio] = useState(true);
  const [editPrice, setEditPrice] = useState("1.00");

  const [editArtPreview, setEditArtPreview] = useState<string>("");
  const [artUploading, setArtUploading] = useState(false);

  const [nowPlaying, setNowPlaying] = useState<TrackView | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Gallery
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);

  // --- Profile state ---
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [profileName, setProfileName] = useState("");

  const [profileCountry, setProfileCountry] = useState("Canada");
  const [profileProvince, setProfileProvince] = useState("Ontario");
  const [profileNeighbourhood, setProfileNeighbourhood] = useState("");

  const [profileCity, setProfileCity] = useState("Ottawa");
  const [profileBio, setProfileBio] = useState("");
const [avatarPath, setAvatarPath] = useState<string | null>(null);

// ✅ Upload gate: require bio before uploads
const [bioGateOpen, setBioGateOpen] = useState(false);

const bioComplete = useMemo(() => {
  const nameOk = (profileName ?? "").trim().length >= 2;

  const countryOk = (profileCountry ?? "").trim().length >= 2;
  const provinceOk = (profileProvince ?? "").trim().length >= 2;
  const cityOk = (profileCity ?? "").trim().length >= 2;
  const hoodOk = (profileNeighbourhood ?? "").trim().length >= 2;

  const bioOk = (profileBio ?? "").trim().length >= 10;

  return nameOk && countryOk && provinceOk && cityOk && hoodOk && bioOk;
}, [
  profileName,
  profileCountry,
  profileProvince,
  profileCity,
  profileNeighbourhood,
  profileBio,
]);

  // --- NEXT SHOW (events MVP) ---
  const [showDate, setShowDate] = useState<string>("");
  const [eventTrackId, setEventTrackId] = useState<string>("");
  const [flyerPath, setFlyerPath] = useState<string | null>(null);
  const [flyerUploading, setFlyerUploading] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Lightbox state (Gallery)
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
    () => displayName || profileName || bandSlug || "Band",
    [displayName, profileName, bandSlug]
  );

  const avatarUrl = useMemo(
    () => withCacheBust(getAvatarUrl(avatarPath)),
    [avatarPath]
  );

  const flyerUrl = useMemo(
    () => (flyerPath ? withCacheBust(getFlyerUrl(flyerPath)) : ""),
    [flyerPath]
  );

  // default event track picker to first track
  useEffect(() => {
    if (!eventTrackId && tracks.length) setEventTrackId(tracks[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length]);

  async function getAuthedUserId(): Promise<string | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  }

  async function doLogout() {
    setLoggingOut(true);
    setStatus("Logging out...");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setStatus(`Logout error: ${error.message}`);
        return;
      }
      setStatus("");
      router.push("/band");
    } finally {
      setLoggingOut(false);
    }
  }

  async function refreshTracks() {
    if (!bandSlug) {
      setTracks([]);
      setStatus("Missing band in URL. Example: /band/1st-show?name=1st%20Show");
      return;
    }

    setStatus("Loading tracks...");
    const { data, error } = await supabase
      .from("tracks")
      .select(
        "id,title,country,province,neighbourhood,city,genre,is_radio,band_slug,file_path,art_path,price_cents,created_at"
      )
      .eq("band_slug", bandSlug)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      setStatus(`DB load error: ${error.message}`);
      return;
    }

    const mapped: TrackView[] = (data ?? []).map((r: TrackRow) => ({
      ...r,
      url: getPublicUrl(r.file_path),
      artUrl: getArtworkUrl(r.art_path),
    }));

    setTracks(mapped);
    setStatus(mapped.length ? "" : "No tracks yet. Upload one!");
  }

  async function loadEvents() {
    if (!bandSlug) return;

    setEventsLoading(true);

    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("events")
      .select("id,band_slug,city,genre,show_date,flyer_path,track_id,created_at")
      .eq("band_slug", bandSlug)
      .gte("show_date", today)
      .order("show_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      setStatus(`Event load error: ${error.message}`);
      setEvents([]);
      setEventsLoading(false);
      return;
    }

    setEvents((data ?? []) as EventRow[]);
    setEventsLoading(false);
  }

  // --- Load/save profile from band_users ---
  async function loadProfile() {
    if (!bandSlug) return;

    const uid = await getAuthedUserId();
    if (!uid) {
      setStatus("Not logged in.");
      return;
    }

    setProfileLoading(true);

    const { data, error } = await supabase
      .from("band_users")
      .select(
        "user_id, band_slug, band_name, display_name, country, province, neighbourhood, city, bio, avatar_path"
      )
      .eq("band_slug", bandSlug)
      .eq("user_id", uid)
      .single();

    if (error) {
      setStatus(`Profile load error: ${error.message}`);
      setProfileLoading(false);
      return;
    }

    const row = data as BandUserProfileRow;

    const name = normSpaces(row.display_name ?? row.band_name ?? "");
    const country = toTitleCaseSmart(row.country ?? "") || "Canada";
    const province = toTitleCaseSmart(row.province ?? "") || "Ontario";
    const city = toTitleCaseSmart(row.city ?? "") || "Ottawa";
        const neighbourhood = toTitleCaseSmart(row.neighbourhood ?? "Centre Town");
    const bio = row.bio ?? "";
    const av = row.avatar_path ?? null;

    setProfileName(name);
    setProfileCountry(country);
    setProfileProvince(province);
    setProfileCity(city);
    setProfileNeighbourhood(neighbourhood);
    setProfileBio(bio);
    setAvatarPath(av);

    setDisplayName((prev) => prev || name);

    setProfileLoading(false);
  }

  async function saveProfile() {
    if (!bandSlug) return;

    const uid = await getAuthedUserId();
    if (!uid) {
      setStatus("Not logged in.");
      return;
    }

    const cleanName = normSpaces(profileName);

    const cleanCountry = toTitleCaseSmart(profileCountry) || "Canada";
    const cleanProvince = toTitleCaseSmart(profileProvince) || "Ontario";
    const cleanNeighbourhood = toTitleCaseSmart(profileNeighbourhood);

    const cleanCity = toTitleCaseSmart(profileCity) || "Ottawa";
    const cleanBio = normSpaces(profileBio);

    setProfileSaving(true);
    setStatus("Saving profile...");

    const upd = await supabase
      .from("band_users")
      .update({
        display_name: cleanName,
        country: cleanCountry,
        province: cleanProvince,
        neighbourhood: cleanNeighbourhood || null,
        city: cleanCity,
        bio: cleanBio,
        avatar_path: avatarPath,
      })
      .eq("band_slug", bandSlug)
      .eq("user_id", uid);

    if (upd.error) {
      setStatus(`Profile save error: ${upd.error.message}`);
      setProfileSaving(false);
      return;
    }

    // If update didn't match any row, insert
    const check = await supabase
      .from("band_users")
      .select("user_id")
      .eq("band_slug", bandSlug)
      .eq("user_id", uid)
      .maybeSingle();

    if (!check.error && !check.data) {
      const ins = await supabase.from("band_users").insert({
        user_id: uid,
        band_slug: bandSlug,
        band_name: cleanName || bandSlug,
        display_name: cleanName,
        country: cleanCountry,
        province: cleanProvince,
        neighbourhood: cleanNeighbourhood || null,
        city: cleanCity,
        bio: cleanBio,
        avatar_path: avatarPath,
      });

      if (ins.error) {
        setStatus(`Profile insert error: ${ins.error.message}`);
        setProfileSaving(false);
        return;
      }
    }

    setProfileName(cleanName);
    setProfileCountry(cleanCountry);
    setProfileProvince(cleanProvince);
    setProfileNeighbourhood(cleanNeighbourhood);
    setProfileCity(cleanCity);
    setProfileBio(cleanBio);

    setStatus("Profile saved.");
    setTimeout(() => setStatus(""), 1200);
    setProfileSaving(false);
  }

  async function uploadAvatar(file: File) {
    if (!bandSlug) {
      setStatus("Error: band slug missing.");
      return;
    }

    const uid = await getAuthedUserId();
    if (!uid) {
      setStatus("Not logged in.");
      return;
    }

    const ok =
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.type === "image/webp";
    if (!ok) {
      setStatus("Avatar must be PNG, JPG, or WEBP.");
      return;
    }

    setAvatarUploading(true);
    setStatus("Uploading profile pic...");

    try {
      const originalName = file.name || "avatar";
      const safeName = safeFileName(originalName);
      const ext = safeName.split(".").pop()?.toLowerCase() || "jpg";
      const storagePath = `bands/${bandSlug}/avatar/${Date.now()}_${crypto.randomUUID()}.${ext}`;

      if (avatarPath) {
        await supabase.storage.from("avatars").remove([avatarPath]);
      }

      const up = await supabase.storage.from("avatars").upload(storagePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (up.error) throw up.error;

      setAvatarPath(storagePath);

      const { error } = await supabase
        .from("band_users")
        .update({ avatar_path: storagePath })
        .eq("band_slug", bandSlug)
        .eq("user_id", uid);

      if (error) throw error;

      setStatus("Profile pic uploaded.");
      setTimeout(() => setStatus(""), 1200);
    } catch (e: any) {
      setStatus(`Avatar upload failed: ${e?.message ?? String(e)}`);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onUpload(file: File) {
    if (!bandSlug) {
      setStatus("Error: band slug missing. Go to /band/1st-show");
      return;
    }

    setUploading(true);
    setStatus("Uploading...");

    try {
      const originalName = file?.name ?? "track";
      const safeName = safeFileName(originalName);
      const storagePath = `bands/${bandSlug}/${Date.now()}_${safeName}`;

      const up = await supabase.storage.from("tracks").upload(storagePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (up.error) throw up.error;

      const defaultTitle = originalName.replace(/\.[^/.]+$/, "");

      const cleanCity = toTitleCaseSmart(profileCity) || "Ottawa";
      const cleanCountry = toTitleCaseSmart(profileCountry) || "Canada";
      const cleanProvince = toTitleCaseSmart(profileProvince) || "Ontario";
      const cleanNeighbourhood = toTitleCaseSmart(profileNeighbourhood);

      const ins = await supabase.from("tracks").insert({
        band_slug: bandSlug,
        title: defaultTitle,

        // ✅ snapshot
        country: cleanCountry,
        province: cleanProvince,
        city: cleanCity,
        neighbourhood: cleanNeighbourhood || null,


        genre: "Punk", // keep as-is for now
        is_radio: true,

        file_path: storagePath,
        price_cents: 100,
      });

      if (ins.error) throw ins.error;

      setStatus("Upload complete.");
      await refreshTracks();
    } catch (e: any) {
      setStatus(`Upload failed: ${e?.message ?? String(e)}`);
    } finally {
      setUploading(false);
    }
  }

  function startEdit(t: TrackView) {
    const cents = Number((t as any).price_cents ?? 100);
    setEditPrice((cents / 100).toFixed(2));

    setEditingId(t.id);
    setEditTitle(t.title ?? "");
    setEditGenre(t.genre ?? ""); // ✅ NEW
    setEditRadio(!!t.is_radio);

    if (editArtPreview) URL.revokeObjectURL(editArtPreview);
    setEditArtPreview("");
    setArtUploading(false);
  }

  async function saveEdit(id: string) {
    const cleanTitle = normSpaces(editTitle);
    if (!cleanTitle) {
      setStatus("Title can't be empty.");
      return;
    }

    const parsed = Number(editPrice || "1");
    const safe = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    const price_cents = Math.round(safe * 100);

    setStatus("Saving...");

    const cleanGenre = toTitleCaseSmart(editGenre || ""); // ✅ NEW (nice formatting)

    const patch = {
      title: cleanTitle,
      genre: cleanGenre || "Punk", // ✅ NEW (fallback)
      is_radio: editRadio,
      price_cents,
    };

    const { error } = await supabase.from("tracks").update(patch).eq("id", id);
    if (error) {
      setStatus(`Edit failed: ${error.message}`);
      return;
    }

    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

    setEditingId(null);
    setStatus("");
  }

  async function pickAndUploadArtwork(track: TrackView, file: File) {
    if (!bandSlug) {
      setStatus("Error: band slug missing.");
      return;
    }

    const scrollY = window.scrollY;

    if (editArtPreview) URL.revokeObjectURL(editArtPreview);
    const previewUrl = URL.createObjectURL(file);
    setEditArtPreview(previewUrl);

    setArtUploading(true);
    setStatus("Uploading artwork...");

    try {
      const originalName = file.name || "art";
      const safeName = safeFileName(originalName);
      const storagePath = `bands/${bandSlug}/art/${track.id}_${Date.now()}_${safeName}`;

      if (track.art_path) {
        await supabase.storage.from("artwork").remove([track.art_path]);
      }

      const up = await supabase.storage.from("artwork").upload(storagePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (up.error) throw up.error;

      const { error } = await supabase
        .from("tracks")
        .update({ art_path: storagePath })
        .eq("id", track.id);
      if (error) throw error;

      const newPublic = getArtworkUrl(storagePath);
      setTracks((prev) =>
        prev.map((p) =>
          p.id === track.id
            ? { ...p, art_path: storagePath, artUrl: withCacheBust(newPublic) }
            : p
        )
      );

      setStatus("Artwork uploaded.");

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setEditArtPreview("");

      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    } catch (e: any) {
      setStatus(`Artwork upload failed: ${e?.message ?? String(e)}`);
    } finally {
      setArtUploading(false);
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    }
  }

  async function uploadFlyer(file: File) {
    if (!bandSlug) {
      setStatus("Error: band slug missing.");
      return;
    }
    if (!showDate) {
      setStatus("Pick a show date first, then upload flyer.");
      return;
    }

    const ok =
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.type === "image/webp";
    if (!ok) {
      setStatus("Flyer must be PNG, JPG, or WEBP.");
      return;
    }

    setFlyerUploading(true);
    setEventStatus("Uploading flyer...");

    try {
      const originalName = file.name || "flyer";
      const safeName = safeFileName(originalName);
      const ext = safeName.split(".").pop()?.toLowerCase() || "jpg";

      const storagePath = `bands/${bandSlug}/flyers/${showDate}_${Date.now()}_${crypto.randomUUID()}.${ext}`;

      const up = await supabase.storage.from("flyers").upload(storagePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (up.error) throw up.error;

      setFlyerPath(storagePath);

      const city = toTitleCaseSmart(profileCity) || "Ottawa";
      const genre = "Punk";

      const payload = {
        band_slug: bandSlug,
        city,
        genre,
        show_date: showDate,
        flyer_path: storagePath,
        track_id: eventTrackId || null,
      };

      const { error } = await supabase
        .from("events")
        .upsert(payload, { onConflict: "band_slug,show_date" });

      if (error) throw error;

      setEventStatus("Flyer uploaded + saved ✅");
      setTimeout(() => setStatus(""), 2000);

      await loadEvents?.();
    } catch (e: any) {
      setEventStatus(`Flyer upload failed: ${e?.message ?? String(e)}`);
    } finally {
      setFlyerUploading(false);
    }
  }

  async function saveNextShow() {
    if (!bandSlug) return;

    if (!showDate) {
      setStatus("Pick a show date first.");
      return;
    }

    setEventSaving(true);
    setEventStatus("Submitting your band for this event...");

    try {
      const city = toTitleCaseSmart(profileCity) || "Ottawa";
      const genre = "Punk";

      const payload = {
        band_slug: bandSlug,
        city,
        genre,
        show_date: showDate,
        flyer_path: flyerPath || null,
        track_id: eventTrackId || null,
      };

      const { error } = await supabase
        .from("events")
        .upsert(payload, { onConflict: "band_slug,show_date" });

      if (error) {
        const msg = (error as any)?.message ?? String(error);
        const looksLikeConflictMissing =
          msg.toLowerCase().includes("there is no unique or exclusion constraint") ||
          msg.toLowerCase().includes("on conflict") ||
          msg.toLowerCase().includes("constraint");

        if (!looksLikeConflictMissing) throw error;

        await supabase
          .from("events")
          .delete()
          .eq("band_slug", bandSlug)
          .eq("show_date", showDate);

        const ins = await supabase.from("events").insert(payload);
        if (ins.error) throw ins.error;
      }

      setEventStatus(
        "✅ Submitted! Your submission is saved (and will update if you re-submit this date)."
      );
      await loadEvents();
      setTimeout(() => setStatus(""), 2200);
    } catch (e: any) {
      setEventStatus(`Event submit failed: ${e?.message ?? String(e)}`);
    } finally {
      setEventSaving(false);
    }
  }

  async function deleteTrack(t: TrackView) {
    const ok = confirm(
      `Delete "${t.title}"?\n\nThis removes the DB row and the audio file.`
    );
    if (!ok) return;

    setStatus("Deleting...");

    if (t.file_path) {
      const rm = await supabase.storage.from("tracks").remove([t.file_path]);
      if (rm.error) {
        setStatus(`Storage delete failed: ${rm.error.message}`);
        return;
      }
    }

    if (t.art_path) {
      const rmArt = await supabase.storage.from("artwork").remove([t.art_path]);
      if (rmArt.error) {
        setStatus(`Artwork delete failed: ${rmArt.error.message}`);
        return;
      }
    }

    const del = await supabase.from("tracks").delete().eq("id", t.id);
    if (del.error) {
      setStatus(`DB delete failed: ${del.error.message}`);
      return;
    }

    if (nowPlaying?.id === t.id) setNowPlaying(null);
    setStatus("");
    await refreshTracks();
  }

  async function loadGallery() {
    if (!bandSlug) return;

    const uid = await getAuthedUserId();
    if (!uid) return;

    setGalleryLoading(true);
    try {
      const folder = `${uid}/${bandSlug}`;

      const { data, error } = await supabase.storage.from("band-gallery").list(folder, {
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
    } catch (e: any) {
      setStatus(`Gallery load failed: ${e?.message ?? String(e)}`);
    } finally {
      setGalleryLoading(false);
    }
  }

  async function uploadGalleryPhoto(file: File) {
    if (!bandSlug) return;

    const uid = await getAuthedUserId();
    if (!uid) {
      setStatus("Not logged in.");
      return;
    }

    const ok =
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.type === "image/webp";
    if (!ok) {
      setStatus("Gallery photo must be PNG, JPG, or WEBP.");
      return;
    }

    setGalleryUploading(true);
    setStatus("Uploading gallery photo...");

    try {
      const safeName = safeFileName(file.name || "photo");
      const ext = safeName.split(".").pop()?.toLowerCase() || "jpg";

      const folder = `${uid}/${bandSlug}`;
      const storagePath = `${folder}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

      const up = await supabase.storage.from("band-gallery").upload(storagePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (up.error) throw up.error;

      await loadGallery();
      setStatus("Gallery photo uploaded ✅");
      setTimeout(() => setStatus(""), 1200);
    } catch (e: any) {
      setStatus(`Gallery upload failed: ${e?.message ?? String(e)}`);
    } finally {
      setGalleryUploading(false);
    }
  }

  async function deleteGalleryPhoto(g: { path: string }) {
    const uid = await getAuthedUserId();
    if (!uid) {
      alert("Not logged in.");
      return;
    }

    const { error } = await supabase.storage.from("band-gallery").remove([g.path]);
    if (error) {
      alert(`Failed to delete photo: ${error.message}`);
      return;
    }

    // verify by listing the same folder
    const folder = `${uid}/${bandSlug}`;
    const filename = g.path.split("/").pop() || "";

    const check = await supabase.storage.from("band-gallery").list(folder, {
      limit: 100,
      offset: 0,
    });

    if (!check.error) {
      const stillThere = (check.data ?? []).some((x) => x.name === filename);
      if (stillThere) {
        alert(
          "Remove() said success, but file is still there. This smells like a permission/policy issue or mismatch."
        );
        return;
      }
    }

    await loadGallery();
  }

useEffect(() => {
  const url = new URL(window.location.href);
  const n = url.searchParams.get("name");
  if (n) setDisplayName(n);

  refreshTracks();
  loadProfile();
  loadGallery();
  loadEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [bandSlug]);

// ✅ If profile is missing required bio fields, force the bio modal open
useEffect(() => {
  // only after profile loads (otherwise it flashes open)
  if (profileLoading) return;

  // Only FORCE it open if incomplete.
  // Do NOT auto-close it when it becomes complete — let the Save button do that.
  if (!bioComplete) setBioGateOpen(true);
}, [profileLoading, bioComplete]);

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

  return (
    <main
      style={{
        padding: 44,
        fontFamily: "sans-serif",
        maxWidth: 1000,
        margin: "0 auto",
      }}
    >
      {/* HEADER */}
      <StreetLevelHeader
        left={
          <>
            <button
              onClick={() => (window.location.href = "/")}
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
            >
              ← Back to Radio
            </button>

            {status ? <div style={{ fontSize: 12, opacity: 0.75 }}>{status}</div> : null}
          </>
        }
        right={
          <button
            onClick={doLogout}
            disabled={loggingOut}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #ddd",
              fontWeight: 950,
              background: "black",
              color: "white",
              cursor: loggingOut ? "not-allowed" : "pointer",
              opacity: loggingOut ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
            title="Sign out"
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        }
      />

      {/* PROFILE ROW */}
      <div
        style={{
          marginTop: 8,
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: 14,
          alignItems: "start",
        }}
      >
        {/* LEFT: Profile Pic */}
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 18,
            padding: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div
            style={{
              fontWeight: 950,
              letterSpacing: 1,
              fontSize: 22,
              lineHeight: 1.1,
              textTransform: "uppercase",
            }}
          >
            {prettyBand}
          </div>

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
                alt="profile pic"
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

          <div style={{ display: "grid", gap: 8 }}>
            <label
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ccc",
                cursor: avatarUploading ? "not-allowed" : "pointer",
                fontWeight: 900,
                background: "black",
                color: "white",
                opacity: avatarUploading ? 0.6 : 1,
                width: "fit-content",
              }}
              title="Select an image — it will upload automatically"
            >
              {avatarUploading ? "Uploading..." : "Upload pic"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={avatarUploading}
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.currentTarget.value = "";
                  if (!f) return;
                  uploadAvatar(f);
                }}
              />
            </label>

            <div style={{ fontSize: 12, opacity: 0.7 }}>
              PNG/JPG/WEBP • square works best {profileLoading ? " • loading..." : ""}
            </div>
          </div>
        </section>

        {/* RIGHT: Bio */}
        <aside
          style={{
            border: "1px solid #eee",
            borderRadius: 18,
            padding: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 950, letterSpacing: 1 }}>About:</div>

          <input
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Name"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
            }}
          />

          <input
            value={profileCountry}
            onChange={(e) => setProfileCountry(e.target.value.toUpperCase())}
            placeholder="Country"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              textTransform: "uppercase",
            }}
            title="Will be saved standardized (ex: Canada)"
          />

          <input
            value={profileProvince}
            onChange={(e) => setProfileProvince(e.target.value.toUpperCase())}
            placeholder="Province / State"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              textTransform: "uppercase",
            }}
            title="Will be saved standardized (ex: Ontario)"
          />

          <input
            value={profileCity}
            onChange={(e) => setProfileCity(e.target.value.toUpperCase())}
            placeholder="City"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              textTransform: "uppercase",
            }}
            title="Will be saved standardized (ex: Ottawa)"
          />

                    <input
            value={profileNeighbourhood}
            onChange={(e) => setProfileNeighbourhood(e.target.value.toUpperCase())}
            placeholder="Neighbourhood (optional)"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              textTransform: "uppercase",
            }}
            title="Optional (ex: Vanier, Centretown, Old Ottawa South)"
          />

          <textarea
            value={profileBio}
            onChange={(e) => setProfileBio(e.target.value)}
            placeholder="Bio"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              minHeight: 92,
              resize: "vertical",
            }}
          />

          <button
            onClick={saveProfile}
            disabled={profileSaving || profileLoading}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "black",
              color: "white",
              fontWeight: 900,
              opacity: profileSaving || profileLoading ? 0.6 : 1,
              cursor: profileSaving || profileLoading ? "not-allowed" : "pointer",
            }}
            title="Saves name/location/bio"
          >
            {profileSaving ? "Saving..." : "Save bio"}
          </button>

          {/* GALLERY */}
          <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 6 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginTop: 2,
              }}
            >
              <div style={{ fontWeight: 950, letterSpacing: 1 }}>Photos:</div>

              <label
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  cursor: galleryUploading ? "not-allowed" : "pointer",
                  fontWeight: 900,
                  background: "black",
                  color: "white",
                  opacity: galleryUploading ? 0.6 : 1,
                  width: "fit-content",
                  flexShrink: 0,
                }}
                title="Upload a band photo"
              >
                {galleryUploading ? "Uploading..." : "Upload photo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={galleryUploading}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.currentTarget.value = "";
                    if (!f) return;
                    uploadGalleryPhoto(f);
                  }}
                />
              </label>
            </div>

            {galleryLoading ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Loading photos…</div>
            ) : gallery.length ? (
              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                  gap: 8,
                }}
              >
                {gallery.map((g, idx) => (
                  <div
                    key={g.path}
                    onClick={() => openLightbox(idx)}
                    style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: "1 / 1",
                      borderRadius: 12,
                      overflow: "hidden",
                      border: "1px solid #eee",
                      background: "#f6f6f6",
                      cursor: "pointer",
                    }}
                    title="Click to enlarge"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openLightbox(idx);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.url}
                      alt={g.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteGalleryPhoto(g);
                      }}
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        zIndex: 5,
                        border: "none",
                        borderRadius: 8,
                        padding: "4px 8px",
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: "pointer",
                        background: "rgba(0,0,0,0.75)",
                        color: "white",
                      }}
                      title="Delete photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                No photos yet. Upload a couple for a mini gallery.
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* NEXT SHOW (events MVP) */}
      <section
        style={{
          marginTop: 14,
          border: "1px solid #eee",
          borderRadius: 18,
          padding: 14,
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 950, letterSpacing: 1 }}>When is your next show?</div>
            {eventStatus ? <div style={{ fontSize: 12, opacity: 0.75 }}>{eventStatus}</div> : null}
          </div>

          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>
            One submission per band per date (saving again updates it)
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: 14,
            alignItems: "start",
          }}
        >
          {/* LEFT: Submit */}
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>DATE</div>
                <input
                  type="date"
                  value={showDate}
                  onChange={(e) => setShowDate(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 6, minWidth: 260 }}>
                <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>
                  SHOWCASE TRACK
                </div>
                <select
                  value={eventTrackId}
                  onChange={(e) => setEventTrackId(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    minWidth: 260,
                  }}
                  title="Pick ONE track for the event playlist"
                >
                  <option value="">Pick a track (optional)</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title || "Untitled"}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>FLYER</div>
                <label
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    cursor: flyerUploading ? "not-allowed" : "pointer",
                    fontWeight: 900,
                    background: "black",
                    color: "white",
                    opacity: flyerUploading ? 0.6 : 1,
                    whiteSpace: "nowrap",
                    width: "fit-content",
                  }}
                  title="Upload the show flyer (PNG/JPG/WEBP)"
                >
                  {flyerUploading
                    ? "Uploading..."
                    : flyerUrl
                    ? "Flyer uploaded ✅ (replace)"
                    : "Upload flyer"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={flyerUploading}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.currentTarget.value = "";
                      if (!f) return;
                      uploadFlyer(f);
                    }}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>SUBMIT</div>
                <button
                  onClick={saveNextShow}
                  disabled={eventSaving || !showDate}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "black",
                    color: "#2bff00",
                    fontWeight: 900,
                    opacity: eventSaving || !showDate ? 0.6 : 1,
                    cursor: eventSaving || !showDate ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                  title={!showDate ? "Pick a date first" : "Save this show"}
                >
                  {eventSaving ? "Saving..." : "Save show"}
                </button>
              </div>

              <div style={{ fontSize: 12, opacity: 0.7, marginLeft: 6 }}>
                City/genre auto from your profile.
              </div>
            </div>

            {flyerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={flyerUrl}
                alt="flyer preview"
                style={{
                  width: "100%",
                  maxWidth: 520,
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                  borderRadius: 16,
                  border: "1px solid #eee",
                }}
              />
            ) : (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Tip: pick date → upload flyer → pick a track → save. (Saving again for the same
                date updates it.)
              </div>
            )}
          </div>

          {/* RIGHT: Your submissions list */}
          <aside
            style={{
              border: "1px solid #eee",
              borderRadius: 16,
              padding: 12,
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 950, letterSpacing: 0.7 }}>Your submitted shows</div>

            {eventsLoading ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Loading…</div>
            ) : events.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {events.slice(0, 6).map((ev) => {
                  const trackTitle =
                    (ev.track_id && tracks.find((t) => t.id === ev.track_id)?.title) || "—";
                  const flyer = withCacheBust(getFlyerUrl(ev.flyer_path));

                  return (
                    <div
                      key={ev.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "64px 1fr",
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
                        <div style={{ fontWeight: 900 }}>{ev.show_date}</div>
                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.75,
                            marginTop: 4,
whiteSpace: "normal",
overflow: "visible",
textOverflow: "clip",
lineHeight: 1.25,
                          }}
                          title={trackTitle}
                        >
                          Song: <b>{trackTitle}</b>
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
                          {ev.city} • {ev.genre}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {events.length > 6 ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Showing latest 6 (you have {events.length}).
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Nothing submitted yet. Your first submit will appear here instantly.
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* MAIN DASHBOARD LAYOUT: Left = Tracks, Right = Merch */}
      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: 14,
          alignItems: "start",
        }}
      >
        {/* LEFT: TRACKS */}
        <section style={{ display: "grid", gap: 10 }}>
          {/* Upload audio ABOVE the list */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "white",
              color: "black",
              padding: "10px 14px",
              borderRadius: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: 900, letterSpacing: 1 }}>TRACKS</div>

            <label
  style={{
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #000",
    cursor: uploading || !bioComplete ? "not-allowed" : "pointer",
    opacity: uploading || !bioComplete ? 0.35 : 1,
    fontWeight: 900,
    background: "black",
    color: "#2bff00",
    whiteSpace: "nowrap",
  }}
  title={
    !bioComplete
      ? "Complete your band bio before uploading songs."
      : "Upload an audio file"
  }
  onClick={(e) => {
    if (!bioComplete) {
      e.preventDefault();
      setBioGateOpen(true);
    }
  }}
>
  Upload audio
  <input
    type="file"
    accept="audio/*"
    disabled={uploading || !bioComplete}
    style={{ display: "none" }}
    onChange={(e) => {
      const f = e.target.files?.[0];
      e.currentTarget.value = "";
      if (!f) return;

      if (!bioComplete) {
        setBioGateOpen(true);
        return;
      }

      onUpload(f);
    }}
  />
</label>
          </div>

          <div style={{ fontSize: 12, opacity: 0.7 }}>{tracks.length} total</div>

          {tracks.map((t) => {
            const priceCents = Number((t as any).price_cents ?? 100);
            const priceLabel = `$${(priceCents / 100).toFixed(2)}`;

            const loc = t.city || "";

            return (
              <div
                key={t.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 14,
                  padding: 12,
                  display: "grid",
                  gap: 8,
                }}
              >
                {editingId === t.id ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title"
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #ccc",
                      }}
                    />
                    <input
  value={editGenre}
  onChange={(e) => setEditGenre(e.target.value)}
  placeholder="Genre (ex: Punk, Pop, Metal)"
  style={{
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ccc",
  }}
  />

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input
                        value={editPrice}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9.]/g, "");
                          setEditPrice(v);
                        }}
                        placeholder="1.00"
                        inputMode="decimal"
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #ccc",
                          flex: "0 0 140px",
                        }}
                        title="Sell price in dollars. Use 0.00 for free / not for sale yet."
                      />

                      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={editRadio}
                          onChange={(e) => setEditRadio(e.target.checked)}
                        />
                        Radio
                      </label>

<div style={{ fontSize: 12, opacity: 0.7 }}>
  Location is a snapshot from upload time. Genre is editable per-song.
</div>
                    </div>

                    {/* Artwork picker (auto-uploads on select) */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <label
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #ccc",
                          cursor: artUploading ? "not-allowed" : "pointer",
                          fontWeight: 900,
                          background: "black",
                          color: "white",
                          opacity: artUploading ? 0.6 : 1,
                        }}
                        title="Select an image — it will upload automatically"
                      >
                        {artUploading ? "Uploading..." : "Pick artwork"}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={artUploading}
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            e.currentTarget.value = "";
                            if (!f) return;
                            pickAndUploadArtwork(t, f);
                          }}
                        />
                      </label>

                      {editArtPreview || t.artUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={editArtPreview || t.artUrl}
                          alt="artwork preview"
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 10,
                            objectFit: "cover",
                            border: "1px solid #eee",
                          }}
                        />
                      ) : null}

                      <div style={{ fontSize: 12, opacity: 0.7 }}>Select image → auto-saves</div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => saveEdit(t.id)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #ccc",
                          fontWeight: 950,
                          background: "black",
                          color: "white",
                        }}
                      >
                        Save
                      </button>

                      <button
                        onClick={() => {
setEditingId(null);
setEditGenre(""); // ✅ NEW
if (editArtPreview) URL.revokeObjectURL(editArtPreview);
setEditArtPreview("");
setArtUploading(false);
                        }}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #ccc",
                          background: "black",
                          color: "white",
                          fontWeight: 900,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "44px minmax(0,1fr) auto",
                        gap: 10,
                        alignItems: "center",
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
                          }}
                        />
                      )}

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 900,
whiteSpace: "normal",
overflow: "visible",
textOverflow: "clip",
lineHeight: 1.25,
 
                          }}
                        >
                          {t.title}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.72,
                            marginTop: 4,
whiteSpace: "normal",
overflow: "visible",
textOverflow: "clip",
lineHeight: 1.25,
                          }}
                          title={loc}
                        >
                        <b>{priceLabel}</b>, {t.is_radio ? "Yes" : "No"} Radio, {loc}, {t.genre}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button
                          onClick={() => startEdit(t)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #ccc",
                            background: "black",
                            color: "white",
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteTrack(t)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #ccc",
                            background: "black",
                            color: "white",
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div style={{ paddingLeft: 54 }}>
                      {t.url ? (
                        <audio
                          controls
                          src={t.url}
                          preload="none"
                          style={{ width: "100%" }}
                          controlsList="nodownload noplaybackrate"
                          onPlay={() => setNowPlaying(t)}
                        />
                      ) : (
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          No public URL yet (file_path is missing or bucket isn’t public)
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* RIGHT: MERCH */}
        <aside style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#eee",
              color: "black",
              padding: "10px 14px",
              borderRadius: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: 900, letterSpacing: 1 }}>MERCH</div>

            <button
              disabled
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: "#888",
                color: "white",
                fontWeight: 900,
                whiteSpace: "nowrap",
                cursor: "not-allowed",
              }}
            >
              Upload merch
            </button>
          </div>

          <section
            style={{
              border: "1px solid #eee",
              borderRadius: 18,
              padding: 14,
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 0.7, fontWeight: 900 }}>
              Coming soon
            </div>

            <div style={{ fontSize: 16, fontWeight: 950, lineHeight: 1.2 }}>
              We’ll add merch items here (shirt / tape / vinyl / patches…)
            </div>

            <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.35 }}>
              Next we’ll wire this to a merch table so bands can add items with:
              <div style={{ marginTop: 8 }}>• name</div>
              <div>• price</div>
              <div>• buy link</div>
              <div>• photo</div>
            </div>

            <button
              disabled
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "black",
                color: "white",
                fontWeight: 900,
                opacity: 0.5,
                cursor: "not-allowed",
              }}
              title="We’ll wire this up next"
            >
              + Add merch item
            </button>
          </section>
        </aside>
      </div>

{/* BIO GATE MODAL (force band to fill bio before uploads) */}
{bioGateOpen ? (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      display: "grid",
      placeItems: "center",
      zIndex: 9998,
      padding: 18,
    }}
  >
    <div
      style={{
        width: "min(720px, 96vw)",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(0,0,0,0.35)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: 14,
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ color: "white", fontWeight: 950, letterSpacing: 0.6 }}>
          Complete your Band Bio to Upload Songs
        </div>

        {/* No close button: this is a “gate”. If you want an escape hatch, tell me and we’ll add it. */}
      </div>

      <div style={{ padding: 14, display: "grid", gap: 10 }}>
        <div style={{ color: "white", fontSize: 12, opacity: 0.85, lineHeight: 1.35 }}>
          Quick setup — this info is used to tag your tracks so listeners can filter by location.
        </div>
<input
  value={profileName}
  onChange={(e) => setProfileName(e.target.value)}
  placeholder="Band name"
  style={{
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
  }}
/>

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
  <input
    value={profileCountry}
    onChange={(e) => setProfileCountry(e.target.value)}
    placeholder="Country"
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.25)",
      background: "rgba(0,0,0,0.25)",
      color: "white",
    }}
  />

  <input
    value={profileProvince}
    onChange={(e) => setProfileProvince(e.target.value)}
    placeholder="Province / State"
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.25)",
      background: "rgba(0,0,0,0.25)",
      color: "white",
    }}
  />
</div>

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
  <input
    value={profileCity}
    onChange={(e) => setProfileCity(e.target.value)}
    placeholder="City"
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.25)",
      background: "rgba(0,0,0,0.25)",
      color: "white",
    }}
  />

  <input
    value={profileNeighbourhood}
    onChange={(e) => setProfileNeighbourhood(e.target.value)}
    placeholder="Neighbourhood"
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.25)",
      background: "rgba(0,0,0,0.25)",
      color: "white",
    }}
  />
</div>
        <textarea
          value={profileBio}
          onChange={(e) => setProfileBio(e.target.value)}
          placeholder="Describe yourself!"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(0,0,0,0.25)",
            color: "white",
            minHeight: 110,
            resize: "vertical",
          }}
        />

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={async () => {
              await saveProfile();
              // saveProfile normalizes + saves; after state updates, this will close via the effect
              // but we can also nudge it instantly:
if (
  (profileName ?? "").trim().length >= 2 &&
  (profileCountry ?? "").trim().length >= 2 &&
  (profileProvince ?? "").trim().length >= 2 &&
  (profileCity ?? "").trim().length >= 2 &&
  (profileNeighbourhood ?? "").trim().length >= 2 &&
  (profileBio ?? "").trim().length >= 5
) {
  setBioGateOpen(false);
}
            }}
            disabled={profileSaving || profileLoading}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "black",
              color: "#2bff00",
              fontWeight: 950,
              opacity: profileSaving || profileLoading ? 0.55 : 1,
              cursor: profileSaving || profileLoading ? "not-allowed" : "pointer",
            }}
          >
            {profileSaving ? "Saving..." : "Save Bio & Continue"}
          </button>

<div style={{ color: "white", fontSize: 12, opacity: 0.75 }}>
  Required: band name, country, province/state, city, neighbourhood, bio (10+ chars)
</div>
        </div>
      </div>
    </div>
  </div>
) : null}

      {/* LIGHTBOX MODAL (Dashboard Gallery) */}
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
                  type="button"
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
                  type="button"
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
                  type="button"
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




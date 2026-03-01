"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import StreetLevelHeader from "../components/StreetLevelHeader";


function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type BandUserRow = {
  user_id: string;
  band_slug: string;
  band_name: string | null;
};

export default function BandLoginPage() {
  const router = useRouter();

  // Auth state
  const [loadingSession, setLoadingSession] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  // Magic link form
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  // Band claim (only shown once if user has no mapping yet)
  const [bandName, setBandName] = useState("");
  const [checkingBandLink, setCheckingBandLink] = useState(false);
  const [claiming, setClaiming] = useState(false);

   // DEV ADMIN JUMP (safe: only works when signed in + allowlisted)
  const ADMIN_EMAILS = useMemo(
    () => new Set(["sean.napalm@gmail.com", "the.sean.waldorf@gmail.com"]),
    []
  );

  const isAdmin = useMemo(() => ADMIN_EMAILS.has(userEmail), [ADMIN_EMAILS, userEmail]);

  const [adminBand, setAdminBand] = useState("");
  const adminSlug = useMemo(() => slugify(adminBand), [adminBand]);

  function adminGo() {
    if (!isAdmin) {
      setStatus("Admin jump disabled for this email.");
      return;
    }
    if (!adminSlug) {
      setStatus('Type a band name first.');
      return;
    }
    setStatus("");
    goToDashboard(adminSlug, adminBand.trim() || adminSlug);
  }

  const bandSlug = useMemo(() => slugify(bandName), [bandName]);
  const bandPretty = useMemo(() => bandName.trim(), [bandName]);
  const canClaim = bandSlug.length > 0;

  function goToDashboard(slug: string, pretty?: string | null) {
    const name = (pretty ?? slug).trim();
    router.push(`/band/${encodeURIComponent(slug)}?name=${encodeURIComponent(name)}`);
  }

  async function refreshSession() {
    setLoadingSession(true);
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setStatus(`Session error: ${error.message}`);
      setUserEmail("");
      setUserId("");
      setLoadingSession(false);
      return;
    }

    const u = data.session?.user;
    setUserEmail(u?.email ?? "");
    setUserId(u?.id ?? "");
    setLoadingSession(false);
  }

  async function checkBandLinkAndRedirect(uid: string) {
    if (!uid) return;

    setCheckingBandLink(true);
    try {
      const { data, error } = await supabase
        .from("band_users")
        .select("user_id, band_slug, band_name")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) {
        // If table/policies not set up yet, you'll see it here.
        setStatus(`Band link lookup error: ${error.message}`);
        return;
      }

      if (data?.band_slug) {
        // Auto-forward — no typing band name again
        goToDashboard(data.band_slug, data.band_name);
      } else {
        // No mapping yet → show claim UI
        setStatus("No band linked to this email yet. Which band should it link to?");
      }
    } finally {
      setCheckingBandLink(false);
    }
  }

  useEffect(() => {
    refreshSession();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshSession();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When we learn userId, try to auto-redirect
  useEffect(() => {
    if (!loadingSession && userId) {
      checkBandLinkAndRedirect(userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingSession, userId]);

  async function sendMagicLink() {
    const clean = email.trim();
    if (!clean) {
      setStatus("Enter your email first.");
      return;
    }

    setStatus("Sending login link...");

    // Safer than hardcoding localhost: works on localhost and production
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/band` : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setStatus(`Login link error: ${error.message}`);
      return;
    }

    setStatus("Check your email for the login link.");
  }

  async function claimBand() {
    if (!userId) {
      setStatus("No user session. Please sign in again.");
      return;
    }
    if (!canClaim) {
      setStatus("Enter your band name first.");
      return;
    }

    setClaiming(true);
    setStatus("Linking your email to this band...");

    try {
      // Insert will fail if it already exists (PK user_id)
      const payload: BandUserRow = {
        user_id: userId,
        band_slug: bandSlug,
        band_name: bandPretty || null,
      };

      const { error } = await supabase.from("band_users").insert(payload);
      if (error) {
        // If user already linked, we can fetch and redirect
        setStatus(`Linking failed: ${error.message}`);
        // Try a re-check in case it already exists
        await checkBandLinkAndRedirect(userId);
        return;
      }

      setStatus("Band linked. Sending you to your dashboard...");
      goToDashboard(bandSlug, bandPretty);
    } finally {
      setClaiming(false);
    }
  }

  async function logout() {
    setStatus("Logging out...");
    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatus(`Logout error: ${error.message}`);
      return;
    }
    setStatus("");
    setUserEmail("");
    setUserId("");
    setBandName("");
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <StreetLevelHeader
        left={
          <div style={{ display: "grid", gap: 6 }}>

            <div style={{ fontSize: 34, fontWeight: 950, lineHeight: 1.05 }}>Band/User login</div>
            <div style={{ opacity: 0.75 }}>
              {userEmail
                ? "Signed in — redirecting to your dashboard.."
                : "Sign in to access your dashboard."}
            </div>
          </div>
        }
        leftSub={status ? status : ""}
        right={
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
            Back to radio
          </Link>
        }
      />
      {/* Body */}
      <div style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
{loadingSession ? (
  <div style={{ opacity: 0.75 }}>Checking session...</div>
) : userEmail ? (
  <>
    <div style={{ fontWeight: 900, marginBottom: 10 }}>You are signed in</div>
    <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 12 }}>
      Logged in as: <b>{userEmail}</b>
    </div>

    {/* ADMIN JUMP (dev convenience) */}
    {isAdmin ? (
      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 12,
          border: "1px solid #eee",
          background: "#fafafa",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Admin jump</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={adminBand}
            onChange={(e) => setAdminBand(e.target.value)}
            placeholder='Whats the band name?'
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              flex: "1 1 260px",
            }}
          />

          <button
            onClick={adminGo}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              fontWeight: 900,
              background: "black",
              color: "#99ff00",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Admin → Open dashboard
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          Will go to: <code>/band/{adminSlug || "..."}</code>
        </div>
      </div>
    ) : null}


            {checkingBandLink ? (
              <div style={{ opacity: 0.75 }}>Checking which band is linked to this email...</div>
            ) : (
              <>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>
                  If you don’t get redirected, claim your band once:
                </div>

                <input
                  value={bandName}
                  onChange={(e) => setBandName(e.target.value)}
                  placeholder='Band name, or user name'
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    width: "100%",
                  }}
                />

                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                  We will permanently link this email to: <code>{bandSlug || "your-band"}</code>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={claimBand}
                    disabled={!canClaim || claiming}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      fontWeight: 900,
                      background: "black",
                      color: "white",
                      cursor: !canClaim || claiming ? "not-allowed" : "pointer",
                      opacity: !canClaim || claiming ? 0.6 : 1,
                    }}
                  >
                    {claiming ? "Linking..." : "Link my email to this band"}
                  </button>

                  <button
                    onClick={logout}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      fontWeight: 900,
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    Log out
                  </button>

                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    After it’s linked once, Band Login goes straight to your dashboard.
                  </span>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Sign in with email</div>

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #ddd",
                width: "100%",
              }}
            />

            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={sendMagicLink}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  fontWeight: 900,
                  background: "black",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Sign in / Send login link
              </button>

              <span style={{ fontSize: 12, opacity: 0.7 }}>
               
              </span>
            </div>
          </>
        )}

        {status ? <div style={{ marginTop: 12, opacity: 0.85 }}>{status}</div> : null}
      </div>
    </main>
  );
}




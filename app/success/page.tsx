"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function SuccessPage() {
  const [status, setStatus] = useState("Verifying payment...");

  const [bandSlug, setBandSlug] = useState("");
  const [returnTo, setReturnTo] = useState("/");
  const [credited, setCredited] = useState<number | null>(null);

  const didVerifyRef = useRef(false);

  useEffect(() => {

    if (didVerifyRef.current) return;
    didVerifyRef.current = true;

    async function verifyAndApply() {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("session_id");
      
console.log("success page sessionId:", sessionId);

      if (!sessionId) {
        setStatus("Missing Stripe session ID.");
        return;
      }

      try {
        const res = await fetch("/api/verify-streetcred-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
        });

        const raw = await res.text();
        console.log("verify response status:", res.status);
        console.log("verify response raw:", raw);

        let data: any = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          setStatus(`Verify route returned non-JSON. Status ${res.status}. Check terminal.`);
          return;
        }

        if (!res.ok) {
          setStatus(data?.error || `Payment verification failed. Status ${res.status}.`);
          return;
        }

        setBandSlug(String(data?.bandSlug ?? ""));
        setReturnTo(String(data?.returnTo ?? "/"));
        setCredited(Number(data?.amountCents ?? 0));
        setStatus("Street Cred added successfully.");
      } catch (err: any) {
        console.error("verify fetch failed:", err);
        setStatus(`Could not verify payment: ${err?.message ?? String(err)}`);
      }
    }

    verifyAndApply();
  }, []);

 

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f6f6",
        padding: 20,
        display: "grid",
        placeItems: "center",
      }}
    >
      <section
        style={{
          width: "min(720px, 100%)",
          background: "white",
          border: "1px solid #eee",
          borderRadius: 18,
          padding: 24,
          display: "grid",
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 950,
            lineHeight: 1.05,
          }}
        >
          Payment successful
        </div>

        <div
          style={{
            fontSize: 16,
            lineHeight: 1.6,
          }}
        >
          {status}
        </div>

        <div
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            border: "1px solid #eee",
            borderRadius: 14,
            padding: 14,
            background: "#fafafa",
          }}
        >
          {credited !== null ? (
            <>
              Added <b>${(credited / 100).toFixed(2)}</b> Street Cred to your account.
            </>
          ) : (
            <>
              We are checking Stripe and applying your Street Cred now.
            </>
          )}
        </div>

<div style={{ display: "flex", gap: 10 }}>
  <Link
    href={returnTo || "/"}
    style={{
      padding: "12px 16px",
      borderRadius: 12,
      border: "1px solid #000",
      textDecoration: "none",
      fontWeight: 950,
      background: "black",
      color: "#2bff00",
    }}
  >
    Back to StreetLevel
  </Link>
</div>
      </section>
    </main>
  );
}
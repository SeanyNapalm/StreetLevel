

"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";

type Props = {
  left?: React.ReactNode;
  right?: React.ReactNode;
  // optional small lines under left (queue, status, etc.)
  leftSub?: React.ReactNode;
  // optional small lines under right if you ever want it
  rightSub?: React.ReactNode;

  // optional: shrink logo on very small screens
  logoSize?: number; // default 220
};

export default function StreetLevelHeader({
  left,
  right,
  leftSub,
  rightSub,
  logoSize = 220,
}: Props) {
  const [aboutOpen, setAboutOpen] = useState(false);

  // close on ESC
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAboutOpen(false);
    }
    if (aboutOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aboutOpen]);

  const contactEmail = useMemo(() => "admin@streetlevel.live", []);

  return (
    <>
      <header
        style={{
          display: "grid",
          gap: 12,
          marginBottom: 18,
        }}
      >
        {/* LOGO (always visible, never squeezed) */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            aria-label="About StreetLevel"
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              justifyContent: "center",
              borderRadius: 14,
            }}
            title="About / Contact"
          >
            <Image
              src="/StreetLevelLogo-Punk.jpg"
              alt="StreetLevel"
              width={logoSize}
              height={logoSize}
              priority
              style={{
                borderRadius: 14,
                maxWidth: "80vw",
                height: "auto",
                transition: "transform 120ms ease, box-shadow 120ms ease",
              }}
            />
          </button>
        </div>

        {/* ACTIONS + SUBTEXT */}
        <div
          style={{
            display: "grid",
            gap: 8,
            justifyItems: "center",
          }}
        >
          {/* Buttons row (wraps on mobile, centered) */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 10,
              width: "100%",
            }}
          >
            {left ? <div>{left}</div> : null}
            {right ? <div>{right}</div> : null}
          </div>

          {/* Sub lines (also centered, no squeeze) */}
          {leftSub || rightSub ? (
            <div
              style={{
                display: "grid",
                gap: 4,
                textAlign: "center",
                width: "100%",
                minHeight: 18, // helps reduce bounce
              }}
            >
              {leftSub ? <div style={{ fontSize: 12, opacity: 0.75 }}>{leftSub}</div> : null}
              {rightSub ? <div style={{ fontSize: 12, opacity: 0.75 }}>{rightSub}</div> : null}
            </div>
          ) : (
            <div style={{ minHeight: 18 }} />
          )}
        </div>
      </header>

      {/* ABOUT MODAL */}
      {aboutOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="About StreetLevel"
          onMouseDown={(e) => {
            // click outside closes
            if (e.target === e.currentTarget) setAboutOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: "min(720px, 96vw)",
              background: "white",
              borderRadius: 18,
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                borderBottom: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ fontWeight: 950, letterSpacing: 0.6 }}>
                About Street Level
              </div>

              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                aria-label="Close"
                style={{
                  border: "1px solid rgba(0,0,0,0.14)",
                  background: "white",
                  borderRadius: 999,
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 16, display: "grid", gap: 12 }}>
              <div style={{ fontSize: 15, lineHeight: 1.4 }}>
                <strong>StreetLevel</strong> is a city-first radio platform built to help
                listeners discover bands — and help bands get heard and supported.
              </div>

              <div style={{ display: "grid", gap: 8, fontSize: 14, lineHeight: 1.4 }}>
                <div>• Pick a city + genre → hit RADIO LETS GO!</div>
                <div>• Bands upload tracks to sell and choose “radio tracks” for discovery.</div>
                <div>• Events can launch instant playlists of those bands only!</div>
              </div>

<div
  style={{
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(0,0,0,0.02)",
    display: "grid",
    gap: 8,
    fontSize: 14,
  }}
>
  <div style={{ fontWeight: 900 }}>Contact</div>

  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
    <Image
      src="/seanynapalm.jpg"
      alt="StreetLevel crew"
      width={63}
      height={63}
      style={{
        borderRadius: 12,
        objectFit: "cover",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.10)",
        flexShrink: 0,
      }}
    />

    <div style={{ lineHeight: 1.2 }}>
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>EMAIL</div>
      <a href={`mailto:${contactEmail}`} style={{ fontWeight: 900, color: "black" }}>
        {contactEmail}
      </a>
    </div>
  </div>
</div>


              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <a
                  href="/"
                  style={{
                    textDecoration: "none",
                    border: "1px solid rgba(0,0,0,0.14)",
                    borderRadius: 999,
                    padding: "10px 14px",
                    fontWeight: 900,
                    color: "black",
                    background: "white",
                  }}
                >
                  Back to Radio
                </a>

                <button
                  type="button"
                  onClick={() => setAboutOpen(false)}
                  style={{
                    border: "1px solid rgba(0,0,0,0.14)",
                    borderRadius: 999,
                    padding: "10px 14px",
                    fontWeight: 900,
                    cursor: "pointer",
                    background: "white",
                  }}
                >
                  Close
                </button>
              </div>


            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import Image from "next/image";
import React from "react";

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
  return (
    <header
      style={{
        display: "grid",
        gap: 12,
        marginBottom: 18,
      }}
    >
      {/* LOGO (always visible, never squeezed) */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Image
          src="/StreetLevelLogo-Punk.jpg"
          alt="StreetLevel"
          width={logoSize}
          height={logoSize}
          priority
          style={{
            borderRadius: 14,
            border: "1px solid #eee",
            maxWidth: "80vw",
            height: "auto",
          }}
        />
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
        {(leftSub || rightSub) ? (
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
  );
}
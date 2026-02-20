"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  // optional small lines under left (queue, status, etc.)
  leftSub?: React.ReactNode;
  // optional small lines under right if you ever want it
  rightSub?: React.ReactNode;
};

export default function StreetLevelHeader({ left, right, leftSub, rightSub }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "end",
        gap: 18,
        marginBottom: 18,
      }}
    >
      {/* LEFT */}
      <div style={{ display: "grid", justifyItems: "start", gap: 10 }}>
        <div>{left}</div>

        {/* reserve space so pages don’t bounce when text appears */}
        <div style={{ minHeight: 18 }}>
          {leftSub ? <div style={{ fontSize: 12, opacity: 0.75 }}>{leftSub}</div> : null}
        </div>
      </div>

      {/* CENTER */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Image
          src="/StreetLevelLogo-Punk.jpg"
          alt="StreetLevel"
          width={299}
          height={299}
          priority
          style={{ borderRadius: 12 }}
        />
      </div>

      {/* RIGHT */}
      <div style={{ display: "grid", justifyItems: "end", gap: 10 }}>
        <div>{right}</div>

        <div style={{ minHeight: 18 }}>
          {rightSub ? <div style={{ fontSize: 12, opacity: 0.75 }}>{rightSub}</div> : null}
        </div>
      </div>
    </div>
  );
}
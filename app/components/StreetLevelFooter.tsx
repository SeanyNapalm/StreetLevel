import Image from "next/image";
import Link from "next/link";

export default function StreetLevelFooter() {
  const year = new Date().getFullYear();
  const email = "seanynapalm@streetlevel.live";

  return (
    <footer
      style={{
        marginTop: 28,
        borderTop: "1px solid #e5e5e5",
        paddingTop: 18,
        paddingBottom: 20,
        background: "#a5a5a541", // 👈 light gray (clean + safe for adsense)
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 18px",
          display: "grid",
          gap: 14,
          justifyItems: "center",
        }}
      >
        {/* LINKS + CONTACT */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 14,
            textAlign: "center",
          }}
        >
          <Link href="/about" style={{ fontWeight: 800, textDecoration: "underline", color: "black" }}>
            About StreetLevel
          </Link>

          <span>|</span>

          <Link href="/FAQ" style={{ fontWeight: 800, textDecoration: "underline", color: "black" }}>
            FAQ
          </Link>

          <span>|</span>

          <Link href="/privacy" style={{ fontWeight: 800, textDecoration: "underline", color: "black" }}>
            Privacy
          </Link>

          <span>|</span>

          <Link href="/terms" style={{ fontWeight: 800, textDecoration: "underline", color: "black" }}>
            Terms
          </Link>

          <span>|</span>

          {/* CONTACT INLINE */}
          <span style={{ fontWeight: 800 }}>Contact:</span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 39,
                height: 39,
                borderRadius: "50%",
                overflow: "hidden",
                border: "1px solid #ddd",
              }}
            >
              <Image
                src="/seanynapalm.jpg"
                alt="Seany Napalm"
                width={39}
                height={39}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>

            <a
              href={`mailto:${email}?subject=StreetLevel`}
              style={{
                fontWeight: 900,
                textDecoration: "underline",
                color: "black",
              }}
            >
              {email}
            </a>
          </div>
        </div>

        {/* COPYRIGHT */}
        <div
          style={{
            fontSize: 12,
            opacity: 0.6,
            textAlign: "center",
          }}
        >
          © {year} StreetLevel
        </div>
      </div>
    </footer>
  );
}
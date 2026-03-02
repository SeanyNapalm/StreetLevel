import Image from "next/image";

function toSmsHref(num: string) {
  const cleaned = (num || "").replace(/[^\d+]/g, "");
  const normalized =
    cleaned.length === 10 ? `+1${cleaned}` : cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  return `sms:${normalized}`;
}

export default function StreetLevelFooter() {
  const year = new Date().getFullYear();

  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "admin@streetlevel.live";
  const smsNumber = process.env.NEXT_PUBLIC_CONTACT_SMS || "6137999532";

  return (
    <footer
      style={{
        marginTop: 18,
        borderTop: "1px solid #eee",
        paddingTop: 14,
        paddingBottom: 16,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Pic */}
        <div
          style={{
            width: 69,
            height: 69,
            borderRadius: 999,
            overflow: "hidden",
            border: "1px solid #eee",
          }}
        >
          <Image
            src="/seanynapalm.jpg"
            alt="Seany Napalm"
            width={38}
            height={38}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        {/* Inline Contact Line */}
        <div style={{ fontSize: 14 }}>
        <span style={{ fontWeight: 950 }}>
            Need any Help?:
        </span>{" "}
          <a
            href={`mailto:${email}`}
            style={{ fontWeight: 900, textDecoration: "underline", color: "black" }}
          >
            Email me
          </a>{" "}
          or{" "}
          <a
            href={toSmsHref(smsNumber)}
            style={{ fontWeight: 900, textDecoration: "underline", color: "black" }}
          >
            Text me
          </a>{" "}
          if you have any issues!
        </div>

        {/* Copyright */}
        <div style={{ fontSize: 12, opacity: 0.55, whiteSpace: "nowrap" }}>
          © {year} StreetLevel
        </div>
      </div>
    </footer>
  );
}

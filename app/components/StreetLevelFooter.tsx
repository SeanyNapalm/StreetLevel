import Image from "next/image";

type Props = {
  email?: string;          // show + mailto link
  smsNumber?: string;      // used ONLY for sms: link (not displayed)
  avatarSrc?: string;      // default: /seanynapalm.jpg
  textIconSrc?: string;    // default: /textme.jpg
};

function toSmsHref(num: string) {
  const cleaned = (num || "").replace(/[^\d+]/g, "");
  const normalized =
    cleaned.length === 10 ? `+1${cleaned}` : cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  return `sms:${normalized}`;
}

export default function StreetLevelFooter({
  email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  smsNumber = process.env.NEXT_PUBLIC_CONTACT_SMS || "",
  avatarSrc = "/seanynapalm.jpg",
  textIconSrc = "/textme.jpg",
}: Props) {
  const year = new Date().getFullYear();

  const hasEmail = !!email.trim();
  const hasSms = !!smsNumber.trim();

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
          gap: 14,
          flexWrap: "wrap",          // ✅ wraps on small screens
        }}
      >
        {/* Pic */}
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            overflow: "hidden",
            border: "1px solid #eee",
            background: "#f6f6f6",
            flex: "0 0 auto",
          }}
          title="Seany Napalm"
        >
          <Image
            src={avatarSrc}
            alt="Seany Napalm"
            width={42}
            height={42}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        {/* Blurb */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <span style={{ fontWeight: 950, letterSpacing: 0.4 }}>Need help?</span>
          <span style={{ fontSize: 13, opacity: 0.75 }}>
            Contact me if you hit any issues or need something fixed.
          </span>
        </div>

        {/* Email */}
        {hasEmail ? (
          <a
            href={`mailto:${email}`}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid #ddd",
              textDecoration: "none",
              fontWeight: 900,
              background: "black",
              color: "white",
              display: "inline-block",
              whiteSpace: "nowrap",
            }}
            title="Email me"
          >
            Email: {email}
          </a>
        ) : null}

        {/* Text me */}
        {hasSms ? (
          <a
            href={toSmsHref(smsNumber)}
            aria-label="Text me"
            title="Text me"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid #ddd",
              textDecoration: "none",
              fontWeight: 900,
              background: "white",
              color: "black",
              whiteSpace: "nowrap",
            }}
          >
            Text me
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid #eee",
                background: "#fff",
                display: "inline-block",
              }}
            >
              <Image
                src={textIconSrc}
                alt=""
                width={24}
                height={24}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </span>
          </a>
        ) : null}

        {/* Copyright */}
        <div style={{ fontSize: 12, opacity: 0.55, whiteSpace: "nowrap" }}>
          © {year} StreetLevel
        </div>
      </div>
    </footer>
  );
}


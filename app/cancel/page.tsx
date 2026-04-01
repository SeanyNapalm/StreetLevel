import Link from "next/link";

export default function CancelPage() {
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
          Payment cancelled
        </div>

        <div
          style={{
            fontSize: 16,
            lineHeight: 1.6,
          }}
        >
          No worries — nothing was charged.
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
          You can head back and try again whenever you want.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/"
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
import Image from "next/image";
import Link from "next/link";
import StreetLevelFooter from "../components/StreetLevelFooter";

export const metadata = {
  title: "Terms of Use – StreetLevel",
  description: "Terms of use for the StreetLevel music platform.",
};

function termsBox(title: string, body: React.ReactNode) {
  return (
    <section
      style={{
        display: "grid",
        gap: 10,
        border: "1px solid #eee",
        borderRadius: 18,
        padding: 20,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 900,
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>

      <div
        style={{
          fontSize: 16,
          lineHeight: 1.65,
        }}
      >
        {body}
      </div>
    </section>
  );
}

export default function TermsPage() {
  const contactEmail = "seanynapalm@streetlevel.live";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "white",
        color: "black",
        fontFamily: "sans-serif",
        padding: "24px 16px 48px",
      }}
    >
      <div
        style={{
          width: "min(900px, 100%)",
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Image
            src="/StreetLevelLogo-Punk.jpg"
            alt="StreetLevel"
            width={220}
            height={220}
            priority
            style={{
              borderRadius: 16,
              width: "min(220px, 70vw)",
              height: "auto",
            }}
          />
        </div>

        <div style={{ textAlign: "center", display: "grid", gap: 8 }}>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(30px, 5vw, 44px)",
              lineHeight: 1.05,
              fontWeight: 950,
            }}
          >
            Terms of Use
          </h1>

          <div style={{ fontSize: 16, opacity: 0.75 }}>
            Basic rules for using StreetLevel and sharing content on the platform.
          </div>
        </div>

        <section
          style={{
            display: "grid",
            gap: 16,
            border: "1px solid #eee",
            borderRadius: 18,
            padding: 20,
          }}
        >
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65 }}>
            By using StreetLevel, you agree to use the platform respectfully and lawfully. These
            terms are here to protect artists, listeners, and the overall community.
          </p>
        </section>

        {termsBox(
          "Using StreetLevel",
          <>
            StreetLevel is provided as a music discovery and artist support platform. You agree not
            to misuse the service, interfere with the platform, or use it for illegal or abusive
            activity.
          </>
        )}

        {termsBox(
          "Your Content",
          <>
            If you upload music, images, flyers, or other content, you are responsible for that
            material. You may only upload content you own or have permission to use.
          </>
        )}

        {termsBox(
          "Artist Responsibility",
          <>
            Bands and users are responsible for making sure their uploaded songs, artwork, event
            details, and other materials are accurate and do not violate anyone else’s rights.
          </>
        )}

        {termsBox(
          "Prohibited Content",
          <>
            You may not use StreetLevel to post hateful material, harassment,
            malware, spam, or anything intended to harm other users or the platform.
          </>
        )}

        {termsBox(
          "Accounts and Access",
          <>
            StreetLevel may suspend, restrict, or remove accounts or content that violate these
            terms, harm the community, or create legal or technical problems.
          </>
        )}

        {termsBox(
          "Purchases and Support",
          <>
            Some artists may offer music, merch, or other items for support. StreetLevel may expand
            these features over time. Availability, pricing, and artist offerings may change.
          </>
        )}

        {termsBox(
          "No Guarantees",
          <>
            StreetLevel is provided in good faith, but we cannot guarantee uninterrupted service,
            perfect availability, or error-free operation at all times.
          </>
        )}

        {termsBox(
          "Changes to the Platform",
          <>
            StreetLevel is actively evolving. Features, layouts, tools, and policies may change over
            time as the platform grows.
          </>
        )}

        {/* CONTACT BOX */}
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 18,
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 950 }}>Contact</h2>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <Image
              src="/Kim-N-A-Sean.jpg"
              alt="StreetLevel crew"
              width={199}
              height={199}
              style={{
                borderRadius: 14,
                objectFit: "cover",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.10)",
              }}
            />

            <div style={{ lineHeight: 1.35 }}>
              <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900, letterSpacing: 0.6 }}>
                EMAIL
              </div>
              <a
                href={`mailto:${contactEmail}?subject=StreetLevel Terms`}
                style={{
                  fontWeight: 900,
                  color: "black",
                  fontSize: 22,
                  textDecoration: "underline",
                  wordBreak: "break-word",
                }}
              >
                {contactEmail}
              </a>
              <div style={{ marginTop: 8, fontSize: 14, opacity: 0.75 }}>
                Questions about these terms or how StreetLevel works? Reach out anytime.
              </div>
            </div>
          </div>
        </section>

        <div style={{ textAlign: "center", marginTop: 6 }}>
          <Link
            href="/"
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #ddd",
              textDecoration: "none",
              fontWeight: 950,
              background: "black",
              color: "#2bff00",
            }}
          >
            Back to Radio
          </Link>
        </div>
      </div>
      <StreetLevelFooter />
    </main>
  );
}
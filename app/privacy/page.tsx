import Image from "next/image";
import Link from "next/link";
import StreetLevelFooter from "../components/StreetLevelFooter";

export const metadata = {
  title: "Privacy Policy – StreetLevel",
  description: "Privacy policy for the StreetLevel music platform.",
};

function policyBox(title: string, body: React.ReactNode) {
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

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>

          <div style={{ fontSize: 16, opacity: 0.75 }}>
            How StreetLevel handles your information and privacy
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
        </section>

        {policyBox(
          "StreetLevel Respects your Privacy",
          <>
            and YOU!
          </>
        )}

        {policyBox(
          "Information We Collect",
          <>
            We do collect information and data from our users, that which the user choses to upload
            and cares to share with us. How else can we shocase your band to the world, right?
            StreetLevel stores it in a secure database, and will never sell any information! Just sharing
            it ONLY to our other users.
          </>
        )}

        {policyBox(
          "How We Use Information",
          <>
            Only for your benefit. We ask you what you want to share with others, and we share
            only that! Simple.
          </>
        )}

        {policyBox(
          "Cookies and Analytics",
          <>
            StreetLevel may use cookies or similar technologies to improve performance, remember
            user preferences, and enhance user experience.
          </>
        )}

        {policyBox(
          "Advertising",
          <>
            StreetLevel may display advertisements in the future. Third-party ad providers, such as
            Google, may use cookies to show relevant ads based on your activity. We gotta find a way 
            to pay artists.. without charging subscriptions like spotify..
          </>
        )}

        {policyBox(
          "Third-Party Services",
          <>
            StreetLevel may use third-party services such as hosting, analytics, or payment
            providers. These services may collect information as required to perform their function.
            Any and ALL information collected will be for StreetLevel use ONLY.
          </>
        )}

        {policyBox(
          "Data Security",
          <>
            We take reasonable steps to protect your information, but no system is completely
            secure. We dont ask you to upload anything you are not willing to share anyway..
            Just dont upload nude photos ya weirdo.
          </>
        )}

        {policyBox(
          "Your Choices",
          <>
            You may choose not to provide certain information. You may also contact us to request
            changes or removal of your data at any time, but we have delete buttons..
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
                href={`mailto:${contactEmail}?subject=StreetLevel Privacy`}
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
                For privacy-related questions, data requests, or support issues, reach out anytime.
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
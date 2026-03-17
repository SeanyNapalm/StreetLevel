import Image from "next/image";
import Link from "next/link";
import StreetLevelFooter from "../components/StreetLevelFooter";

export const metadata = {
  title: "About StreetLevel",
  description:
    "StreetLevel is a city-first music discovery platform built to help listeners discover local bands and help bands get heard and supported.",
};

export default function AboutPage() {
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
            About StreetLevel
          </h1>

          <div style={{ fontSize: 16, opacity: 0.75 }}>
            City-first music discovery for underground, independent, and local bands.
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
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6 }}>
            <strong>StreetLevel</strong> is a city-first radio platform built to help listeners
            discover bands — and help bands get heard and supported.
          </p>

          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65 }}>
            Most music platforms are built around giant catalogs, mainstream momentum, and
            algorithm-driven feeds. StreetLevel is built differently. Want to hear whats 
            vibin' in your city? or another city? choose a city, or a genre, or both! 
            going on tour and need to find the perfect opening bands? this is how!
          </p>

          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65 }}>
            That means someone looking for Ottawa punk, Toronto indie, or local hardcore does not
            need to dig through a mountain of unrelated music first. StreetLevel is designed to
            make local music easier to find, easier to support, and easier to connect to real bands
            and real communities.
          </p>

          <div style={{ display: "grid", gap: 10, fontSize: 16, lineHeight: 1.55 }}>
            <div>• Hit "<strong>RADIO LETS GO!</strong>" to hear everything! Or first set a city, or genre, or both!</div>
            <div>• Bands upload tracks and choose “radio tracks” for discovery.</div>
            <div>• Listeners can move from radio to a band page and explore their pics, merch, and events.</div>
            <div>• Events can launch an instant event playlist that plays one song from each artist on the bill </div>
          </div>

          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65 }}>
            StreetLevel is about helping local scenes grow. It is built for listeners who want to
            discover bands, and for artists who want a fair shot at being heard, record labels seeking bands,
            promoters.. promoting! haha!
            Its got something for every lover of music.
          </p>
        </section>

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
  href={`mailto:${contactEmail}?subject=StreetLevel`}
  target="_self"
  rel="noopener noreferrer"
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
                Questions about bands, radio, events, uploads, or support? Reach out anytime.
              </div>
            </div>
          </div>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
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
      </div>

  <StreetLevelFooter />

    </main>
  );
}
import Image from "next/image";
import Link from "next/link";
import StreetLevelFooter from "../components/StreetLevelFooter";

export const metadata = {
  title: "FAQ – StreetLevel",
  description: "Frequently asked questions about StreetLevel music discovery platform.",
};

function faqBox(title: string, body: React.ReactNode) {
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

export default function FAQPage() {
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
            StreetLevel FAQ
          </h1>

          <div style={{ fontSize: 16, opacity: 0.75 }}>
            Questions, answers, and a bit of punk-rock philosophy.
          </div>
        </div>

        {faqBox(
          "What is StreetLevel?",
          <>
            StreetLevel is a city-first music discovery platform. Instead of searching a massive
            global catalog, you can pick a city and genre to hear music from real local scenes.
          </>
        )}

        {faqBox(
          "How does the radio work?",
          <>
            Choose a city, or a genre, or both, or nothing! Get as specific a playlist as you
            want... then hit <strong>RADIO LETS GO!</strong>. StreetLevel builds a rotating playlist
            from bands in that scene so you can discover new music continuously.
          </>
        )}

        {faqBox(
          "Is this free to use?",
          <>
            Yes. Listening to radio tracks is free. Some bands may offer music or merch for sale on
            their pages to support themselves directly. Purchasing band tracks allows you to play
            their music offline.
          </>
        )}

        {faqBox(
          "How do bands get on StreetLevel?",
          <>
            Click Login in the top right! After email authentication, type your band name and away
            you go! Bands can create a profile to upload their tracks, their pics, their events,
            and choose which songs are available for radio discovery.
          </>
        )}

        {faqBox(
          "What makes StreetLevel different?",
          <>
            StreetLevel focuses on local scenes instead of global algorithms. It’s built to help
            smaller bands get heard and to make it easier for listeners to discover real underground
            music, and help bring that music to the surface, street level, if you will.. ahahah
          </>
        )}

        {faqBox(
          "Can I support bands directly?",
          <>
            Yes. You can visit band pages, explore their music, and support them through purchases
            or engagement. We are adding new features every other day, more ways to support and
            interact with bands.
          </>
        )}

        {faqBox(
          "Why “city-first”?",
          <>
            Music scenes are built locally. StreetLevel keeps that connection strong by letting you
            explore music based on real places instead of just global popularity.
          </>
        )}

        {/* SPECIAL BOX: WHO BUILT STREETLEVEL */}
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 18,
            padding: 20,
            display: "grid",
            gap: 14,
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
            Who built StreetLevel?
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "315px minmax(0, 1fr)",
              gap: 14,
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.10)",
                minHeight: "100%",
                height: "100%",
                background: "#f6f6f6",
              }}
            >
              <Image
                src="/Kim-N-A-Sean.jpg"
                alt="Seany Napalm"
                width={220}
                height={220}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>

            <div
              style={{
                fontSize: 16,
                lineHeight: 1.7,
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 14,
                padding: 16,
                background: "rgba(0,0,0,0.02)",
              }}
            >
              <strong>ME! Seany Napalm!</strong> I am a "musician" lol. I built this because it's
              something I wanted! Something I would love to use. I wanted to showcase bands you
              haven't heard of, let them be heard!

              <br />
              <br />

              I wanted Facebook events to have one easy link to a playlist that plays a song from
              each band. I wanted touring bands and promoters to get a chance to hear the local
              talent, to choose the perfect artists for their events.

              <br />
              <br />

              I wanted artists to actually get <strong>PAID</strong> when people listen to their
              tunes, instead of Spotify, where you need thousands of listens just to break even.
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
import { AUTHOR_NAME, OG_IMAGE_SIZE, ogTitleFontSize, type CoverInfo } from "./presentation-meta";

// Brand tokens from @repo/ui's tailwind config. Satori (next/og) takes inline
// styles only, so the values are repeated here instead of class names.
const COLORS = {
  background: "#021525",
  onSurface: "#d1e4fb",
  muted: "#9fb3c8",
  primary: "#ffb783",
  primaryContainer: "#e67e22",
  secondaryContainer: "#ebbf01",
};
const PIPELINE_GRADIENT = "linear-gradient(90deg, #ffb783 0%, #ebbf01 50%, #243648 100%)";

const MASCOT_SIZE = 400;

/**
 * The 1200×630 share card: the cover's label and title on the left, the mascot
 * (which carries the "Engenharia Inversa" wordmark) on the right and the author
 * at the bottom. Few, large elements: in a chat thumbnail the card is about
 * 300px wide, so anything under ~28px here is noise there.
 */
export function OgCard({ cover, mascotSrc }: { cover: CoverInfo; mascotSrc: string }) {
  const titleSize = ogTitleFontSize(cover.title);
  // The subtitle only fits under a title of at most two lines; the title
  // always wins the space.
  const showSubtitle = cover.subtitle !== null && cover.title.length <= 24;

  return (
    <div
      style={{
        ...OG_IMAGE_SIZE,
        display: "flex",
        position: "relative",
        backgroundColor: COLORS.background,
        color: COLORS.onSurface,
        fontFamily: "Sora",
      }}
    >
      {/* Technical dot grid, as on the site background */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          ...OG_IMAGE_SIZE,
          backgroundImage: "radial-gradient(circle at 20px 20px, rgba(164, 140, 125, 0.35) 0%, rgba(164, 140, 125, 0.35) 6%, transparent 7%)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Orange glow behind the mascot */}
      <div
        style={{
          position: "absolute",
          top: -85,
          left: 590,
          width: 800,
          height: 800,
          backgroundImage: "radial-gradient(circle, rgba(230, 126, 34, 0.30) 0%, rgba(230, 126, 34, 0) 65%)",
        }}
      />
      <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 12, backgroundImage: PIPELINE_GRADIENT }} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 760,
          height: 630,
          padding: "68px 0 56px 64px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {cover.label && (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                marginBottom: 28,
                padding: "8px 20px",
                borderRadius: 999,
                backgroundColor: COLORS.secondaryContainer,
                color: "#231b00",
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              {cover.label}
            </div>
          )}
          <div
            style={{
              display: "block",
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -titleSize * 0.02,
              lineClamp: 4,
            }}
          >
            {cover.title}
          </div>
          {showSubtitle && (
            <div
              style={{
                display: "block",
                marginTop: 24,
                fontSize: 32,
                fontWeight: 600,
                lineHeight: 1.3,
                color: COLORS.muted,
                lineClamp: 2,
              }}
            >
              {cover.subtitle}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 10, height: 76, marginRight: 22, borderRadius: 5, backgroundColor: COLORS.primaryContainer }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>{AUTHOR_NAME}</div>
            <div style={{ marginTop: 6, fontSize: 28, fontWeight: 600, color: COLORS.primary }}>
              engenhariainversa.com.br
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 440, height: 630 }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={mascotSrc} width={MASCOT_SIZE} height={MASCOT_SIZE} />
      </div>
    </div>
  );
}

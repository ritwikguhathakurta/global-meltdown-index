import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Same dark-bg + accent-dot mark used in opengraph-image.tsx, just square —
// also the only real logo asset this app has, so it doubles as the `logo`
// URL referenced from page.tsx's Organization JSON-LD.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0e14",
        }}
      >
        <div style={{ width: 28, height: 28, borderRadius: 14, background: "#3fa9f5" }} />
      </div>
    ),
    { ...size }
  );
}

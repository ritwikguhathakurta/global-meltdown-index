import { ImageResponse } from "next/og";

export const alt = "Global Meltdown Index — Global Financial Early-Warning Intelligence Terminal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0e14",
          color: "#e6ebf2",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: "#3fa9f5" }} />
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "#8b96a8" }}>
            Global Meltdown Index
          </div>
        </div>
        <div style={{ marginTop: 32, fontSize: 60, fontWeight: 700, lineHeight: 1.15, maxWidth: 980 }}>
          See financial stress before it becomes a market story.
        </div>
        <div style={{ marginTop: 28, fontSize: 28, color: "#8b96a8", maxWidth: 1000 }}>
          24 deterministic risk engines, one composite GFMI score — every number real and source-linked.
        </div>
      </div>
    ),
    { ...size }
  );
}

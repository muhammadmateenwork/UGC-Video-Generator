import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Same film-frame-with-a-cut mark as the header, on the paper colour. */
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
          background: "#f2efe7",
          borderRadius: 7,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24">
          <rect x="5" y="2" width="14" height="20" rx="3" fill="#161513" />
          <path d="M3 15.5 21 8.5" stroke="#f2efe7" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="16" cy="5.5" r="1.4" fill="#ff5b24" />
        </svg>
      </div>
    ),
    { ...size }
  );
}

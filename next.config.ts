import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // ffmpeg-static/ffprobe-static resolve their binary path from their own
  // __dirname at runtime; bundling them rewrites that to a path that doesn't
  // exist on disk (observed as a literal "\ROOT\..." ENOENT). Keeping them
  // external makes Node require() them from the real node_modules instead.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
};

export default nextConfig;

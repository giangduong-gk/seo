import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cho phép nhiều tiến trình next (dev/build/start) chạy song song trên cùng repo mà không ghi đè nhau:
  // NEXT_DIST_DIR=.next-qa npx next dev -p 3500
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;

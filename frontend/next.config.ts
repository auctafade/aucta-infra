import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force port 3000
  env: {
    PORT: '3000'
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
    ]
  },
};

export default nextConfig;

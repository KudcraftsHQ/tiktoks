import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.tiktokcdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.tiktokcdn-us.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.bytedance.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/api/images/proxy/**',
      },
    ],
  },
};

export default nextConfig;

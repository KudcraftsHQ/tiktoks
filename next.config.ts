import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  output: 'standalone',
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
  experimental: {
    turbo: {
      resolveAlias: {
        canvas: './empty.js',
      },
    },
  },
  webpack: (config) => {
    config.externals = [...config.externals, { canvas: 'canvas' }];
    return config;
  },
};

export default nextConfig;

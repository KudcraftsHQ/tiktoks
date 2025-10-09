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
  serverExternalPackages: [
    '@napi-rs/canvas',
    // Platform-specific packages will be externalized automatically
  ],
  experimental: {
    serverComponentsExternalPackages: [
      '@napi-rs/canvas',
    ],
    turbo: {
      resolveAlias: {
        // Don't alias canvas - we need @napi-rs/canvas to work
        // canvas: './empty.js',
      },
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize @napi-rs/canvas and all its platform-specific packages
      // This prevents webpack from trying to bundle native modules
      config.externals = config.externals || [];
      
      // Add canvas packages to externals
      if (Array.isArray(config.externals)) {
        config.externals.push(
          '@napi-rs/canvas',
          /@napi-rs\/canvas-.*/,  // All platform-specific packages
        );
      }
    } else {
      // On client-side, stub out canvas-related imports
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        '@napi-rs/canvas': false,
      };
    }
    return config;
  },
};

export default nextConfig;

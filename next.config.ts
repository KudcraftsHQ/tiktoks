import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
    '@resvg/resvg-js',
    // Platform-specific packages will be externalized automatically
  ],
  turbopack: {
    resolveAlias: {
      // Don't alias canvas - we need @napi-rs/canvas to work
      // canvas: './empty.js',
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize @napi-rs/canvas and all its platform-specific packages
      // This prevents webpack from trying to bundle native modules
      config.externals = config.externals || [];
      
      // Add canvas and resvg packages to externals
      if (Array.isArray(config.externals)) {
        config.externals.push(
          '@napi-rs/canvas',
          /@napi-rs\/canvas-.*/,  // All platform-specific packages
          '@resvg/resvg-js',
          /@resvg\/resvg-.*/,     // All platform-specific resvg packages
        );
      }
    } else {
      // On client-side, stub out canvas-related imports
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        '@napi-rs/canvas': false,
        '@resvg/resvg-js': false,
      };
    }
    return config;
  },
};

// Wrap the config with Sentry for error tracking and source maps
export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  // Upload source maps to Sentry for better error stack traces
  // Note: Source maps are hidden from client bundles but uploaded to Sentry
  sourcemaps: {
    disable: false,
  },

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
});

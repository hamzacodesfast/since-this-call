/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'abs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'images-api.printify.com',
      },
    ],
  },
  // Ensure we can use Edge functions
  experimental: {
    // serverActions: true, // Enabled by default in Next.js 14
    serverComponentsExternalPackages: ['ioredis'],
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'sincethiscall.com',
          },
        ],
        destination: 'https://www.sincethiscall.com/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://disqus.com https://*.disqus.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: https://pbs.twimg.com https://abs.twimg.com https://images-api.printify.com; connect-src 'self' https:; font-src 'self' data:; frame-src 'self' https://disqus.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

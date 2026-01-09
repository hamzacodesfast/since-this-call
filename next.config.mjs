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
    ],
  },
  // Ensure we can use Edge functions
  experimental: {
    // serverActions: true, // Enabled by default in Next.js 14
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;

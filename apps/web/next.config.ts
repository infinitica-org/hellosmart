import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hs/ui'],
  async rewrites() {
    return [
      {
        source: '/admin/organizations',
        destination: '/api/admin/organizations',
      },
    ];
  },
};

export default nextConfig;

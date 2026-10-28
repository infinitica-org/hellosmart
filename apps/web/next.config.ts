import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hs/ui'],
  devIndicators: {
    buildActivityPosition: 'bottom-right',
    appIsrStatus: false,
  },
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

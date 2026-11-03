import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@hs/ui'],
  devIndicators: {
    buildActivityPosition: 'bottom-right',
    appIsrStatus: false,
  },
  async rewrites() {
    const apiBase = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
    return [
      {
        source: '/admin/organizations',
        destination: '/api/admin/organizations',
      },
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

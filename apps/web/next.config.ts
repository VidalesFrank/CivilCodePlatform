import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@civilcode/ui', '@civilcode/icons'],
  experimental: {
    // Enable optimizations compatible with React 19
    optimizePackageImports: ['@civilcode/ui', '@civilcode/icons'],
  },
}

export default nextConfig

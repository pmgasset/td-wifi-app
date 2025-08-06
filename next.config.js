/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove output: 'export' for Vercel deployment with API routes
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Environment variables are handled by Vercel's dashboard
  // No need to expose them here
  async generateBuildId() {
    return 'build-' + Date.now()
  },
  // Ensure API routes work properly
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/old-product-page',
        destination: '/products',
        permanent: true,
      },
      {
        source: '/shop',
        destination: '/products',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig

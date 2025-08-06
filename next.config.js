/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove output: 'export' for Vercel deployment with API routes
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    AUTH0_BASE_PATH: '/api/auth',
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
}

module.exports = nextConfig

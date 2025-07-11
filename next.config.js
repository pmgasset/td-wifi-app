// ===== next.config.js =====
/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET,
    ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN,
    ZOHO_STORE_ID: process.env.ZOHO_STORE_ID,
  },
  async generateBuildId() {
    return 'build-' + Date.now()
  }
}

module.exports = nextConfig
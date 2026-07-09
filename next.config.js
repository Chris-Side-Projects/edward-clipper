/** @type {import('next').NextConfig} */
const nextConfig = {
  // Railway provides PORT environment variable, fallback to 3000 for local dev
  env: {
    PORT: process.env.PORT || '3000'
  },
  // Ensure proper static file handling
  trailingSlash: false,
  // Enable standalone output for Railway
  output: 'standalone'
}

module.exports = nextConfig
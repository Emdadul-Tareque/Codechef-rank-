/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The scraper route needs a generous body limit (large handle lists) and
  // Node.js runtime (Edge runtime can't use `cheerio`/full `fetch` timeouts the way we need).
  eslint: {
    // We lint locally; don't fail Vercel production builds on lint warnings.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;

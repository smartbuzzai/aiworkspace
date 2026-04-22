/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "standalone", // re-enable when build environment supports worker threads
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    proxyTimeout: 120000,
  },
  swcMinify: false,
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`
      }
    ];
  }
};

export default nextConfig;

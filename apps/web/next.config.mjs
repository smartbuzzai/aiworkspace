/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    proxyTimeout: 120000
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`
      }
    ];
  }
};

export default nextConfig;

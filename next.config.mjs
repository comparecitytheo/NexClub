/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" }
    ]
  },
  experimental: {
    serverActions: { bodySizeLimit: "5mb" }
  }
};
export default nextConfig;

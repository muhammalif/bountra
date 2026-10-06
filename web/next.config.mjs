/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@privy-io/react-auth", "viem"]
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/cdp-sdk": false,
      "@base-org/account": false,
      "@x402": false,
      "@farcaster/mini-app-solana": false,
      "@abstract-foundation/agw-client": false
    };
    return config;
  }
};

export default nextConfig;

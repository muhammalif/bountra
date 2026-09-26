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
  env: {
    NEXT_PUBLIC_PRIVY_APP_ID: "cmugrtffe02sw0di7hao4m2u1",
    NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS: "0xbe576879961Bd8cdf7CfA72F146C8a3E352c7260",
    NEXT_PUBLIC_MOCK_USDT_ADDRESS: "0x189C7cA448e89DaF1C2A1C9a4DB4D9Ec475441c1",
    NEXT_PUBLIC_CHAIN_ID: "97",
    NEXT_PUBLIC_AGENT_API_URL: "http://localhost:3001"
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

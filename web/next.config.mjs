import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const emptyStub = path.resolve(__dirname, "src/stubs/empty.js");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack, isServer }) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false
    };

    // Stub Privy/Wagmi optional deps not needed for BNB Chain (EVM-only)
    const stubModules = [
      "@solana/kit",
      "@solana-program/memo",
      "@solana-program/token",
      "@solana-program/system",
      "@farcaster/mini-app-solana",
      "@abstract-foundation/agw-client",
      "permissionless",
      "@x402/evm/upto/client",
      "@x402/evm/exact/client",
      "@x402/svm/exact/client",
      "@x402/core/client",
      "@x402/evm"
    ];

    for (const mod of stubModules) {
      config.resolve.alias[mod] = emptyStub;
    }

    return config;
  }
};

export default nextConfig;

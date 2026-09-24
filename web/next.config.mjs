/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false
    };

    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /(@coinbase\/cdp-sdk|@base-org\/account|@x402|@farcaster\/mini-app-solana|@abstract-foundation\/agw-client)/
      })
    );

    return config;
  }
};

export default nextConfig;

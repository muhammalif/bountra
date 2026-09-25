import { createConfig } from "@privy-io/wagmi";
import { fallback, http } from "viem";
import { bscTestnet, opBNBTestnet } from "viem/chains";

export const wagmiConfig = createConfig({
  chains: [bscTestnet, opBNBTestnet],
  ssr: false,
  transports: {
    [bscTestnet.id]: fallback([
      http("https://data-seed-prebsc-1-s1.bnbchain.org:8545", { timeout: 8000, retryCount: 1 }),
      http("https://bsc-testnet.publicnode.com", { timeout: 8000, retryCount: 1 }),
      http("https://bsc-testnet-dataseed.bnbchain.org", { timeout: 8000, retryCount: 1 })
    ]),
    [opBNBTestnet.id]: fallback([
      http("https://opbnb-testnet-rpc.bnbchain.org", { timeout: 8000, retryCount: 1 })
    ])
  }
});

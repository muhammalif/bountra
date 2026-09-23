import { createConfig } from "@privy-io/wagmi";
import { http } from "viem";
import { bscTestnet, opBNBTestnet } from "viem/chains";

export const wagmiConfig = createConfig({
  chains: [bscTestnet, opBNBTestnet],
  ssr: true,
  transports: {
    [bscTestnet.id]: http("https://data-seed-prebsc-1-s1.bnbchain.org:8545"),
    [opBNBTestnet.id]: http("https://opbnb-testnet-rpc.bnbchain.org")
  }
});

"use client";

import { ReactNode, useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { bscTestnet, opBNBTestnet } from "viem/chains";
import { wagmiConfig } from "../config/wagmi";

interface Web3ProviderProps {
  children: ReactNode;
}

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cl00000000000000000000000";

export function Web3Provider({ children }: Web3ProviderProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5000,
        refetchOnWindowFocus: false
      }
    }
  }));

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["github", "wallet", "email"],
        appearance: {
          theme: "dark",
          accentColor: "#F0B90B",
          logo: "/logo.png",
          showWalletLoginFirst: false
        },
        defaultChain: bscTestnet,
        supportedChains: [bscTestnet, opBNBTestnet],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets"
          }
        }
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

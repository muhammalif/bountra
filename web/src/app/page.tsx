"use client";

import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/hero/HeroSection";
import { AuditTerminal } from "@/components/terminal/AuditTerminal";
import { BOUNTRA_ESCROW_ADDRESS, BOUNTRA_ESCROW_ABI } from "@/config/contracts";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: bountyCount } = useReadContract({
    address: BOUNTRA_ESCROW_ADDRESS,
    abi: BOUNTRA_ESCROW_ABI,
    functionName: "bountyCount",
    query: {
      enabled: mounted
    }
  });

  return (
    <div className="min-h-screen flex flex-col justify-between bg-surface-primary selection:bg-brand-primary selection:text-black">
      <Header />
      <main className="flex-1 flex flex-col justify-center">
        <HeroSection
          bountyCount={typeof bountyCount === "bigint" ? Number(bountyCount) : 0}
          onExploreClick={() => {
            const el = document.getElementById("audit-terminal");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          onCreateBountyClick={() => {
            // Modal trigger will be bound in Task H3.4
          }}
        />

        <AuditTerminal />
      </main>
      <Footer />
    </div>
  );
}

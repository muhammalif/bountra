"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { LogIn, LogOut, Github, Compass, LayoutDashboard, Terminal } from "lucide-react";
import { formatAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { address } = useAccount();

  const activeAddress = user?.wallet?.address || address;

  const navLinks = [
    { href: "/", label: "Home", icon: Terminal },
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }
  ];

  return (
    <header className="border-b border-surface-border bg-surface-secondary/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-brand-primary flex items-center justify-center font-bold text-black text-lg transition-transform group-hover:scale-105">
              B
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-content-primary">BOUNTRA</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-tertiary border border-surface-border text-brand-primary font-mono">
                BSC Testnet
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 font-mono text-xs">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors",
                    isActive
                      ? "bg-surface-tertiary text-brand-primary font-semibold"
                      : "text-content-secondary hover:text-content-primary hover:bg-surface-tertiary/50"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <nav className="flex md:hidden items-center gap-1 font-mono text-xs mr-2">
            <Link
              href="/explore"
              className={cn(
                "px-2.5 py-1 rounded-md text-xs",
                pathname === "/explore" ? "text-brand-primary font-semibold" : "text-content-secondary"
              )}
            >
              Explore
            </Link>
            <Link
              href="/dashboard"
              className={cn(
                "px-2.5 py-1 rounded-md text-xs",
                pathname === "/dashboard" ? "text-brand-primary font-semibold" : "text-content-secondary"
              )}
            >
              Dashboard
            </Link>
          </nav>

          {ready && authenticated ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs text-content-secondary font-mono flex items-center justify-end gap-1">
                  <Github className="w-3 h-3 text-brand-primary" />
                  {user?.github?.username ? `@${user.github.username}` : "Connected"}
                </span>
                <span className="text-xs font-mono text-content-primary">
                  {formatAddress(activeAddress)}
                </span>
              </div>
              <button
                onClick={logout}
                className="px-3 py-1.5 rounded-lg border border-surface-border bg-surface-tertiary text-content-secondary hover:text-content-primary hover:border-brand-primary/50 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="px-4 py-2 rounded-lg bg-brand-primary text-black font-semibold text-sm hover:bg-brand-hover flex items-center gap-2 transition-all shadow-sm active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Connect / GitHub</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useDisconnect } from "wagmi";
import { LogIn, LogOut, Github, Compass, LayoutDashboard, Terminal, ChevronDown, Copy, Check } from "lucide-react";
import { formatAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeAddress = user?.wallet?.address || address;
  const isLoggedIn = Boolean((ready && authenticated) || (isConnected && Boolean(address)));

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeAddress) {
      navigator.clipboard.writeText(activeAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = async () => {
    setIsDropdownOpen(false);
    try {
      if (authenticated) {
        await logout();
      }
      if (isConnected) {
        disconnect();
      }
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const navLinks = [
    { href: "/", label: "Home", icon: Terminal },
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }
  ];

  return (
    <header className="border-b border-surface-border bg-surface-secondary/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black border border-surface-border transition-transform group-hover:scale-105 shrink-0">
              <Image
                src="/bountra-logo.png"
                alt="Bountra Logo"
                fill
                className="object-cover p-1"
                priority
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-content-primary">BOUNTRA</span>
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

          {isLoggedIn ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-surface-border bg-surface-tertiary hover:border-brand-primary/50 text-content-primary transition-all text-xs font-mono group"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div className="flex flex-col text-left">
                  {user?.github?.username && (
                    <span className="text-[10px] text-content-muted leading-tight flex items-center gap-1">
                      <Github className="w-2.5 h-2.5 text-brand-primary" />
                      @{user.github.username}
                    </span>
                  )}
                  <span className="font-semibold text-content-primary">
                    {formatAddress(activeAddress)}
                  </span>
                </div>
                <ChevronDown className={cn(
                  "w-3.5 h-3.5 text-content-muted group-hover:text-content-primary transition-transform duration-200",
                  isDropdownOpen && "rotate-180"
                )} />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-surface-border bg-surface-secondary shadow-xl py-1 z-50 animate-in fade-in-0 zoom-in-95">
                  <div className="px-3 py-2 border-b border-surface-border">
                    <p className="text-[10px] text-content-muted uppercase tracking-wider font-semibold">Connected Wallet</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-xs text-content-primary truncate mr-2">
                        {activeAddress ? `${activeAddress.slice(0, 8)}...${activeAddress.slice(-6)}` : "No address"}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAddress}
                        className="text-content-muted hover:text-brand-primary p-1 rounded transition-colors"
                        title="Copy full address"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-1">
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => login()}
              disabled={!ready}
              className={cn(
                "px-4 py-2 rounded-lg bg-brand-primary text-black font-semibold text-sm hover:bg-brand-hover flex items-center gap-2 transition-all shadow-sm active:scale-95",
                !ready && "opacity-70 cursor-not-allowed"
              )}
            >
              <LogIn className="w-4 h-4" />
              <span>{ready ? "Connect Wallet" : "Connecting..."}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

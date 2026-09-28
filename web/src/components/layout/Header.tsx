"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useDisconnect } from "wagmi";
import { LogIn, LogOut, Github, Compass, LayoutDashboard, Terminal, ChevronDown, Copy, Check, Menu, X } from "lucide-react";
import { formatAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const activeAddress = user?.wallet?.address || address;
  const isLoggedIn = Boolean((ready && authenticated) || (isConnected && Boolean(address)));

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile sheet is open
  useEffect(() => {
    if (!isMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMenuOpen]);

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

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") setIsMenuOpen(false);
  };

  useEffect(() => {
    if (!isMenuOpen) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMenuOpen]);

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0 shrink">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group min-w-0">
            <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden bg-black border border-surface-border transition-transform group-hover:scale-105 shrink-0">
              <Image
                src="/bountra-logo.png"
                alt="Bountra Logo"
                fill
                className="object-cover p-0.5 sm:p-1"
                priority
              />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="hidden min-[380px]:block font-bold text-base sm:text-lg tracking-tight text-content-primary truncate">BOUNTRA</span>
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
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors min-h-[44px] active:scale-95",
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

        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isMenuOpen}
            className="md:hidden rounded-lg border border-surface-border bg-surface-tertiary p-2 text-content-primary hover:border-brand-primary/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 shrink-0"
          >
            <Menu className="h-4 w-4" />
          </button>

          {isLoggedIn ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-surface-border bg-surface-tertiary hover:border-brand-primary/50 active:border-brand-primary/50 text-content-primary transition-all text-xs font-mono group active:scale-95 min-h-[44px]"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <div className="flex flex-col text-left">
                  {user?.github?.username && (
                    <span className="hidden sm:flex text-[10px] text-content-muted leading-tight items-center gap-1">
                      <Github className="w-2.5 h-2.5 text-brand-primary" />
                      @{user.github.username}
                    </span>
                  )}
                  <span className="font-semibold text-content-primary truncate max-w-[90px] sm:max-w-none">
                    {formatAddress(activeAddress)}
                  </span>
                </div>
                <ChevronDown className={cn(
                  "w-3.5 h-3.5 text-content-muted group-hover:text-content-primary transition-transform duration-200 shrink-0",
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
                      className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 transition-colors min-h-[40px]"
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
                "px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-brand-primary text-black font-semibold text-xs sm:text-sm hover:bg-brand-hover flex items-center gap-1.5 sm:gap-2 transition-all shadow-sm active:scale-95 min-h-[36px] shrink-0",
                !ready && "opacity-70 cursor-not-allowed"
              )}
            >
              <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>
                {ready ? (
                  <>
                    <span className="inline sm:hidden">Connect</span>
                    <span className="hidden sm:inline">Connect Wallet</span>
                  </>
                ) : (
                  <>
                    <span className="inline sm:hidden">Wait</span>
                    <span className="hidden sm:inline">Connecting...</span>
                  </>
                )}
              </span>
            </button>
          )}
        </div>
      </div>

      {isMenuOpen && mounted &&
        createPortal(
        <div className="md:hidden fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMenuOpen(false)}
          />

          <div className="absolute top-0 right-0 h-full w-[82%] max-w-sm bg-surface-secondary border-l border-surface-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ease-out">
            <div className="flex items-center justify-between h-14 px-4 border-b border-surface-border shrink-0">
              <span className="font-bold text-sm tracking-tight text-content-primary">Navigation</span>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-lg border border-surface-border bg-surface-tertiary p-2 text-content-primary hover:border-brand-primary/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex flex-col gap-1.5 p-4 flex-1 overflow-y-auto">
              {navLinks.map((link, i) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors min-h-[52px] text-sm font-medium",
                      isActive
                        ? "bg-brand-primary/10 text-brand-primary font-semibold border border-brand-primary/30"
                        : "text-content-secondary hover:text-content-primary hover:bg-surface-tertiary/50 border border-transparent",
                      "animate-in fade-in-0 slide-in-from-right duration-300 [animation-fill-mode:backwards]"
                    )}
                    style={{ animationDelay: `${80 + i * 60}ms` }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-surface-border shrink-0">
              {isLoggedIn && activeAddress ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-surface-border bg-surface-tertiary px-3 py-3 min-h-[52px]">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-content-muted font-mono">Connected Wallet</span>
                    <span className="font-mono text-xs font-semibold text-content-primary truncate">
                      {formatAddress(activeAddress)}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    login();
                  }}
                  disabled={!ready}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 rounded-xl bg-brand-primary text-black font-semibold text-sm py-3.5 hover:bg-brand-hover transition-all active:scale-[0.98] min-h-[52px]",
                    !ready && "opacity-70 cursor-not-allowed"
                  )}
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>{ready ? "Connect Wallet" : "Connecting..."}</span>
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
        )}
    </header>
  );
}

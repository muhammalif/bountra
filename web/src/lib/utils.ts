import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address?: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatBscScanUrl(type: "address" | "tx", hash: string, chainId = 97): string {
  const base = chainId === 5611 ? "https://opbnb-testnet.bscscan.com" : "https://testnet.bscscan.com";
  return `${base}/${type}/${hash}`;
}

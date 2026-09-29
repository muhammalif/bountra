"use client";

import { useCallback, useEffect, useState } from "react";

export interface ClaimAuthorization {
  authorized: boolean;
  signature?: string;
  rawHash?: string;
  digest?: string;
  verdict?: string;
  score?: number;
}

export interface ClaimEligibility {
  bountyId: number;
  prUrl: string;
  commitHash: string;
  verdict: string;
  score: number;
  hasSignature: boolean;
  auditLogId: number;
}

/**
 * Asks the agent for the signature on a specific claim.
 *
 * The signature is never stored or minted in the browser — the agent only
 * releases one that already exists for a passing audit of the exact
 * (bounty, pr, commit, developer) scope. A 409 here means "not audited", not
 * "try again", so the caller must surface it rather than retry.
 */
export function useClaimAuthorization() {
  const [authorization, setAuthorization] = useState<ClaimAuthorization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authorize = useCallback(async (params: {
    bountyId: number;
    prUrl: string;
    commitHash: string;
    devWallet: string;
  }) => {
    setIsLoading(true);
    setError(null);
    setAuthorization(null);
    try {
      const res = await fetch("/api/agent/claim/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = (await res.json()) as ClaimAuthorization & { error?: string };

      if (!res.ok) {
        setError(data.error || "Agent did not authorize this claim.");
        return null;
      }
      setAuthorization(data);
      return data;
    } catch (err) {
      setError((err as Error).message || "Failed to reach the Bountra Agent.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { authorization, isLoading, error, authorize };
}

/**
 * Bounties this developer has a passing audit for.
 *
 * Replaces guessing claimability from mock bounty status: a row only appears
 * here when the agent actually holds a signature for it, so the Developer Hub
 * cannot offer a claim that the contract would reject.
 */
export function useClaimEligibility(developer?: string) {
  const [eligible, setEligible] = useState<ClaimEligibility[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!developer) {
      setEligible([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/claim/eligible?developer=${encodeURIComponent(developer)}`);
      const data = (await res.json()) as { data?: ClaimEligibility[]; error?: string };
      if (!res.ok) {
        setError(data.error || "Failed to load claimable bounties.");
        return;
      }
      setEligible(data.data || []);
    } catch (err) {
      setError((err as Error).message || "Failed to reach the Bountra Agent.");
    } finally {
      setIsLoading(false);
    }
  }, [developer]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { eligible, isLoading, error, refetch };
}

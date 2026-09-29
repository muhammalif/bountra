export type BountyStatus = "open" | "in_review" | "ready_to_claim" | "claimed" | "rejected" | "cancelled";

export interface BountyItem {
  id: number;
  creator: string;
  token: string;
  tokenSymbol: string;
  amount: string;
  amountFormatted: string;
  issueUrl: string;
  repo: string;
  issueNumber: number;
  title: string;
  description: string;
  tags: string[];
  deadline: number;
  claimed: boolean;
  cancelled: boolean;
  status: BountyStatus;
  /**
   * Hash of the claim transaction that settled this bounty.
   *
   * Lives on the agent's audit row rather than on-chain: the contract records
   * that a payout happened, not which transaction carried it. Absent until the
   * claim is confirmed, and absent for a claimed bounty the agent never
   * confirmed — so callers must handle it as optional even when claimed is true.
   */
  claimTxHash?: string;
  isOnChain?: boolean;
}

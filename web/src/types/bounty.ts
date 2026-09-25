export type BountyStatus = "open" | "in_review" | "claimed" | "cancelled";

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
}

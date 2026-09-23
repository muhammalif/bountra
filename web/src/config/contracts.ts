import { parseAbi, type Address } from "viem";

export const BOUNTRA_ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ||
  "0xbe576879961Bd8cdf7CfA72F146C8a3E352c7260") as Address;

export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 97);

export const BOUNTRA_ESCROW_ABI = parseAbi([
  "event BountyCreated(uint256 indexed bountyId, address indexed creator, address indexed token, uint256 amount, string issueUrl, uint256 deadline)",
  "event BountyClaimed(uint256 indexed bountyId, address indexed developer, string commitHash, string prUrl, uint256 amount)",
  "event BountyCancelled(uint256 indexed bountyId, address indexed creator, uint256 amount)",
  "function createBounty(address token, uint256 amount, string calldata issueUrl, uint256 deadline) external returns (uint256)",
  "function claimBounty(uint256 bountyId, address devWallet, string calldata commitHash, string calldata prUrl, bytes calldata signature) external",
  "function cancelBounty(uint256 bountyId) external",
  "function getBounty(uint256 bountyId) external view returns (address creator, bool claimed, bool cancelled, address token, uint256 amount, uint256 deadline, string memory issueUrl)",
  "function bountyCount() external view returns (uint256)",
  "function agentSigner() external view returns (address)",
  "function usedSignatures(bytes32 digest) external view returns (bool)"
]);

export const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
]);
